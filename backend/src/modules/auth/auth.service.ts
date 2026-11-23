import {
  Injectable,
  ConflictException,
  NotFoundException,
  UnauthorizedException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { UserRepository } from './repositories/user.repository';
import {
  RegisterDto,
  LoginDto,
  AuthResponseDto,
  LoginResponseDto,
  AddAdminDto,
  UpdateProfileDto,
  USERNAME_PATTERN,
  USERNAME_MESSAGE,
} from './dto/auth.dto';
import { UserRole, hasRetiredStaffRole } from '../../common/interfaces';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditLogService } from '../../common/audit/audit.service';
import { isEligiblePlayerAccount } from '../../common/validation/player-eligibility';

/** Same message for an unknown account and a wrong password, so login cannot be used to probe accounts. */
const INVALID_CREDENTIALS = 'Invalid username/email or password';

const STAFF_ROLES = new Set<string>([
  UserRole.SUPER_ADMIN,
  UserRole.FINANCE_MODERATOR,
  UserRole.COMMUNITY_MODERATOR,
]);

export const isStaff = (user: { role?: string; adminType?: string | null } | null | undefined) =>
  !!user && (STAFF_ROLES.has(String(user.role || '').toLowerCase()) || !!user.adminType);

export const isSuperAdmin = (user: { role?: string; adminType?: string | null } | null | undefined) =>
  !!user && (user.role === UserRole.SUPER_ADMIN || user.adminType === UserRole.SUPER_ADMIN);

/** A readable one-time password; never a fixed default. */
export function generateTemporaryPassword(): string {
  return randomBytes(9).toString('base64').replace(/[+/=]/g, '').slice(0, 12);
}

@Injectable()
export class AuthService {
  constructor(
    private userRepository: UserRepository,
    private jwtService: JwtService,
    private notificationsService: NotificationsService,
    private auditLog: AuditLogService,
  ) {}

  async register(registerDto: RegisterDto): Promise<AuthResponseDto> {
    const email = registerDto.email.trim().toLowerCase();
    const username = registerDto.username.trim();

    if (await this.userRepository.emailExists(email)) {
      throw new ConflictException('Email already registered');
    }
    if (await this.userRepository.usernameExists(username)) {
      throw new ConflictException('Username already taken');
    }

    const user = await this.userRepository.createWithPassword(email, username, registerDto.password, UserRole.PARTICIPANT);
    await this.auditLog.record('ACCOUNT_REGISTERED', {
      actor: user.username, entityType: 'user', entityId: user.id,
      details: `Account @${user.username} registered.`,
      metadata: { username: user.username },
    });

    return {
      user: { id: user.id, email: user.email, username: user.username, role: user.role },
      message: 'Registration successful. You can now log in.',
    };
  }

  async login(loginDto: LoginDto): Promise<LoginResponseDto> {
    const user = await this.userRepository.findWithPasswordByEmailOrUsername(loginDto.emailOrUsername);
    // Compare even when the account is missing so response time does not reveal it either.
    const hash = user?.passwordHash || '$2b$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvali';
    const passwordValid = await bcrypt.compare(loginDto.password, hash).catch(() => false);
    if (!user || !passwordValid) {
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }
    if (user.banned) {
      await this.auditLog.record('LOGIN_BLOCKED', {
        actor: user.username, entityType: 'user', entityId: user.id,
        details: 'Sign-in refused: the account is banned.', metadata: { username: user.username },
      });
      throw new UnauthorizedException('Your account has been banned from this platform.');
    }
    if (hasRetiredStaffRole(user)) {
      await this.auditLog.record('LOGIN_BLOCKED', {
        actor: user.username, entityType: 'user', entityId: user.id,
        details: 'Sign-in refused: the account holds a retired administrator role.', metadata: { username: user.username },
      });
      throw new UnauthorizedException('This administrator role has been removed from the platform.');
    }
    await this.auditLog.record('LOGIN', {
      actor: user.username, entityType: 'user', entityId: user.id,
      details: `@${user.username} signed in.`, metadata: { username: user.username },
    });

    const revokedReason = user.revokedReason || null;
    if (revokedReason) {
      // Shown once, then cleared.
      await this.userRepository.update(user.id, { revokedReason: null as any });
    }

    const payload = {
      sub: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      adminType: user.adminType || user.role,
    };

    return {
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        adminType: user.adminType || user.role,
        profilePicUrl: user.profilePicUrl || null,
        bio: user.bio || null,
        revokedReason,
      } as any,
      access_token: this.jwtService.sign(payload),
      message: 'Login successful',
    };
  }

  async getUserById(id: string) {
    const user = await this.userRepository.findById(id);
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async findUsername(username: string) {
    return this.userRepository.findByUsername(String(username || '').trim().replace(/^@/, ''));
  }

  async getAllUsers() {
    return this.userRepository.findAll();
  }

  /** Up to 8 usernames matching the query (prefix matches first). Never returns emails. */
  async searchUsernames(query: string, scope: 'players' | 'all', requester?: string) {
    const q = query.trim().replace(/^@/, '').toLowerCase();
    if (!q) return [];
    const me = String(requester || '').toLowerCase();
    const rows = (await this.userRepository.findAll())
      .filter((u: any) => !u.banned && String(u.username).toLowerCase() !== me)
      .filter((u: any) => scope === 'all' || isEligiblePlayerAccount(u))
      .filter((u: any) => String(u.username).toLowerCase().includes(q));
    rows.sort((a: any, b: any) => {
      const pa = String(a.username).toLowerCase().startsWith(q) ? 0 : 1;
      const pb = String(b.username).toLowerCase().startsWith(q) ? 0 : 1;
      return pa - pb || String(a.username).localeCompare(String(b.username));
    });
    return rows.slice(0, 8).map((u: any) => ({ username: u.username, role: u.role }));
  }

  /**
   * Super Admin grants a staff role. An existing account is elevated in place;
   * an unknown username creates a new account with a generated one-time
   * password that is returned once and never stored in plain text.
   */
  async addAdmin(dto: AddAdminDto, actor: any) {
    const username = dto.username.trim().replace(/^@/, '');
    const roleValue = dto.adminType as UserRole;
    const existing = await this.userRepository.findByEmailOrUsername(username);

    if (!existing) {
      if (username.includes('@')) {
        throw new BadRequestException('No account uses that email. Enter a username to create a new staff account.');
      }
      if (!USERNAME_PATTERN.test(username)) throw new BadRequestException(USERNAME_MESSAGE);
      const email = dto.email || `${username.toLowerCase()}@nexus.gg`;
      if (await this.userRepository.emailExists(email)) {
        throw new ConflictException('That email is already registered to another account.');
      }
      const temporaryPassword = generateTemporaryPassword();
      const created = await this.userRepository.createWithPassword(email, username, temporaryPassword, roleValue, roleValue);
      await this.auditLog.record('ADMIN_CREATED', {
        actor: actor?.username,
        entityType: 'user',
        entityId: created.id,
        details: `@${created.username} created as ${roleValue}.`,
      });
      return { user: created, created: true, temporaryPassword };
    }

    if (isStaff(existing)) {
      throw new BadRequestException(`@${existing.username} already has a staff role (${existing.adminType || existing.role}).`);
    }
    if (existing.banned) {
      throw new BadRequestException(`@${existing.username} is banned and cannot be given a staff role.`);
    }

    const updated = await this.userRepository.update(existing.id, {
      role: roleValue,
      adminType: roleValue,
      revokedReason: null,
    } as any);
    await this.auditLog.record('ADMIN_ELEVATED', {
      actor: actor?.username,
      entityType: 'user',
      entityId: existing.id,
      details: `@${existing.username} elevated to ${roleValue}.`,
    });
    this.notificationsService.create({
      toUsername: existing.username,
      type: 'role-changed',
      status: 'info',
      title: 'You were given a staff role',
      body: `A Super Admin made you ${roleValue.replace(/_/g, ' ')}. Sign out and back in to see your new dashboard.`,
    }).catch(() => {});
    return { user: updated, created: false };
  }

  async revokeAdmin(usernameOrEmail: string, reason: string | undefined, actor: any) {
    const user = await this.userRepository.findByEmailOrUsername(usernameOrEmail.replace(/^@/, ''));
    if (!user) throw new NotFoundException('No account with that username or email.');
    if (user.id === actor?.id) {
      throw new ForbiddenException('You cannot revoke your own administrator access.');
    }
    if (!isStaff(user)) {
      throw new BadRequestException(`@${user.username} is not an administrator.`);
    }
    if (isSuperAdmin(user)) {
      const remaining = (await this.userRepository.findAll()).filter((u) => isSuperAdmin(u) && !u.banned && u.id !== user.id);
      if (!remaining.length) throw new ForbiddenException('At least one Super Admin must remain.');
    }

    const revocationReason = reason && reason.trim() ? reason.trim() : 'Administrative status revoked by Super Admin';
    const updated = await this.userRepository.update(user.id, {
      role: UserRole.PARTICIPANT,
      adminType: null as any,
      revokedReason: revocationReason,
    });
    await this.auditLog.record('ADMIN_REVOKED', {
      actor: actor?.username,
      entityType: 'user',
      entityId: user.id,
      details: `@${user.username} revoked. Reason: ${revocationReason}`,
    });
    return updated;
  }

  /** Only a Super Admin may act on another staff account, and nobody may act on themselves. */
  private async moderationTarget(usernameOrId: string, actor: any) {
    const target =
      (await this.userRepository.findByEmailOrUsername(usernameOrId)) ||
      (/^[0-9a-f-]{36}$/i.test(usernameOrId) ? await this.userRepository.findById(usernameOrId) : null);
    if (!target) throw new NotFoundException('User not found');
    if (target.id === actor?.id) throw new ForbiddenException('You cannot moderate your own account.');
    if (isSuperAdmin(target)) throw new ForbiddenException('Super Admin accounts cannot be banned or warned.');
    if (isStaff(target) && !isSuperAdmin(actor)) {
      throw new ForbiddenException('Only a Super Admin can moderate another staff account.');
    }
    return target;
  }

  async unbanUser(usernameOrId: string, actor: any): Promise<{ banned: boolean; username: string }> {
    const target = await this.moderationTarget(usernameOrId, actor);
    await this.userRepository.setBanned(target.id, false);
    await this.auditLog.record('USER_UNBANNED', {
      actor: actor?.username,
      entityType: 'user',
      entityId: target.id,
      details: `@${target.username} unbanned.`,
    });
    return { banned: false, username: target.username };
  }

  async warnUser(usernameOrId: string, actor: any, reason?: string): Promise<{ warningCount: number; banned: boolean; username: string }> {
    const target = await this.moderationTarget(usernameOrId, actor);
    const result = await this.userRepository.incrementWarning(target.username);
    await this.auditLog.record('USER_WARNED', {
      actor: actor?.username,
      entityType: 'user',
      entityId: target.id,
      details: `@${target.username} warned (${result.warningCount}/3). ${reason || ''}`.trim(),
    });
    this.notificationsService.create({
      toUsername: target.username,
      type: 'account-warning',
      status: 'info',
      title: result.banned ? 'Your account was banned' : 'You received a warning',
      body: result.banned
        ? 'Your account reached three warnings and was banned.'
        : `An administrator issued warning ${result.warningCount} of 3.${reason ? ` Reason: ${reason}` : ''}`,
    }).catch(() => {});
    return { ...result, username: target.username };
  }

  /**
   * Super Admin / Admin sets a new one-time password for an account after a
   * reset request. The password is returned once to the staff member, who
   * passes it to the user through a trusted channel.
   */
  async resetPassword(usernameOrId: string, actor: any) {
    const target = await this.moderationTarget(usernameOrId, actor);
    const temporaryPassword = generateTemporaryPassword();
    await this.userRepository.updatePassword(target.id, await bcrypt.hash(temporaryPassword, 10));
    await this.auditLog.record('PASSWORD_RESET', {
      actor: actor?.username,
      entityType: 'user',
      entityId: target.id,
      details: `Temporary password issued for @${target.username}.`,
    });
    return { username: target.username, temporaryPassword };
  }

  /**
   * Forgot Password: there is no email service, so the request goes to the
   * administrators, who issue a temporary password. The response is the same
   * whether or not the account exists.
   */
  async requestPasswordReset(emailOrUsername: string) {
    const user = await this.userRepository.findByEmailOrUsername(emailOrUsername);
    if (user && !user.banned) {
      const admins = (await this.userRepository.findAll()).filter(
        (u) => !u.banned && isSuperAdmin(u),
      );
      await Promise.all(
        admins.map((admin) =>
          this.notificationsService.create({
            toUsername: admin.username,
            type: 'password-reset-request',
            status: 'pending',
            title: 'Password reset requested',
            body: `@${user.username} asked for a password reset. Open Users, choose the account and select Reset password.`,
            meta: { username: user.username },
          }).catch(() => {}),
        ),
      );
    }
    return {
      message:
        'If an account matches, an administrator has been notified and will contact you with a temporary password.',
    };
  }

  async updateProfile(id: string, updates: UpdateProfileDto) {
    const clean: Partial<{ bio: string; profilePicUrl: string }> = {};
    if (updates.bio !== undefined) clean.bio = updates.bio.trim();
    if (updates.profilePicUrl !== undefined) clean.profilePicUrl = updates.profilePicUrl.trim() || null;
    const before: any = await this.userRepository.findById(id);
    const updated = await this.userRepository.update(id, clean as any);
    // Before/after values, except image data (only whether it changed).
    const changes: Record<string, { from: any; to: any }> = {};
    if (clean.bio !== undefined && clean.bio !== (before?.bio || '')) changes.bio = { from: before?.bio || '', to: clean.bio };
    if (clean.profilePicUrl !== undefined && clean.profilePicUrl !== (before?.profilePicUrl || null)) {
      changes.profilePicture = { from: before?.profilePicUrl ? 'set' : 'none', to: clean.profilePicUrl ? 'set' : 'none' };
    }
    if (Object.keys(changes).length) {
      await this.auditLog.record('PROFILE_UPDATED', {
        actor: before?.username || id, entityType: 'user', entityId: id,
        details: `Profile updated: ${Object.keys(changes).join(', ')}.`,
        metadata: { username: before?.username, changes },
      });
    }
    return updated;
  }

  /** Sign-out is client-side (the JWT is discarded); this records it in the activity log. */
  async recordLogout(user: any) {
    await this.auditLog.record('LOGOUT', {
      actor: user?.username, entityType: 'user', entityId: user?.sub || user?.id || user?.userId,
      details: `@${user?.username} signed out.`, metadata: { username: user?.username },
    });
    return { ok: true };
  }

  async changeEmail(id: string, email: string, currentPassword: string) {
    const user = await this.userRepository.findWithPasswordById(id);
    if (!user) throw new NotFoundException('User not found');
    if (!(await bcrypt.compare(currentPassword, user.passwordHash || ''))) {
      throw new UnauthorizedException('Current password is incorrect');
    }
    const next = email.trim().toLowerCase();
    if (next === String(user.email).toLowerCase()) return this.userRepository.findById(id);
    const other = await this.userRepository.findByEmail(next);
    if (other && other.id !== id) throw new ConflictException('That email is already registered to another account.');
    const updated = await this.userRepository.update(id, { email: next });
    await this.auditLog.record('EMAIL_CHANGED', {
      actor: user.username,
      entityType: 'user',
      entityId: id,
      details: `Email changed from ${user.email} to ${next}.`,
    });
    return updated;
  }

  async changePassword(id: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await this.userRepository.findWithPasswordById(id);
    if (!user) throw new NotFoundException('User not found');

    const valid = await bcrypt.compare(currentPassword, user.passwordHash || '');
    if (!valid) throw new UnauthorizedException('Current password is incorrect');
    if (currentPassword === newPassword) {
      throw new BadRequestException('The new password must be different from the current one.');
    }

    await this.userRepository.updatePassword(id, await bcrypt.hash(newPassword, 10));
    await this.auditLog.record('PASSWORD_CHANGED', {
      actor: user.username, entityType: 'user', entityId: id,
      details: 'Password changed by the account owner.', metadata: { username: user.username },
    });
  }
}
