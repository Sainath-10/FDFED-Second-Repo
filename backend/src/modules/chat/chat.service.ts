import { BadRequestException, ForbiddenException, HttpException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, IsNull, MoreThan, Repository } from 'typeorm';
import { ChatChannel, ChatMessageEntity } from '../../entities/chat-message.entity';
import { CompetitionRepository } from '../competitions/repositories/competition.repository';
import { TeamRepository } from '../teams/repositories/team.repository';

const GENERAL_LIMIT = 5;
const GENERAL_WINDOW_MS = 30_000;
const activeTeam = (status: string) => status === 'approved';
const sameUser = (a: string, b: string) => String(a || '').toLowerCase() === String(b || '').toLowerCase();

@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(ChatMessageEntity) private readonly messages: Repository<ChatMessageEntity>,
    private readonly competitions: CompetitionRepository,
    private readonly teams: TeamRepository,
  ) {}

  private async assertCompetitionAccess(competitionId: string, username: string, channel: ChatChannel, writing: boolean) {
    if (!username) throw new ForbiddenException('Sign in to use competition chat.');
    const competition = await this.competitions.findById(competitionId);
    if (!competition) throw new NotFoundException('Competition not found.');
    const organizer = [competition.createdBy, ...(competition.organizers || [])].some(name => sameUser(name, username));
    if (channel === 'announcements' && writing && !organizer) throw new ForbiddenException('Only competition organizers can post announcements.');
    if (!organizer) {
      const teams = await this.teams.findByCompetition(competitionId);
      const member = teams.some(team => activeTeam(team.status) && (team.memberUsernames || []).some(name => sameUser(name, username)));
      if (!member) throw new ForbiddenException('Only current competition participants and organizers can use this chat.');
    }
  }

  private async assertTeamAccess(teamId: string, username: string) {
    if (!username) throw new ForbiddenException('Sign in to use team chat.');
    const team = await this.teams.findById(teamId);
    if (!team) throw new NotFoundException('Team not found.');
    if (!activeTeam(team.status) || !(team.memberUsernames || []).some(name => sameUser(name, username))) {
      throw new ForbiddenException('Only current members of this team can use its chat.');
    }
    return team;
  }

  private async recent(where: FindOptionsWhere<ChatMessageEntity>) {
    const newest = await this.messages.find({ where, order: { createdAt: 'DESC', id: 'DESC' }, take: 100 });
    return newest.reverse();
  }

  async listCompetition(competitionId: string, channel: 'announcements' | 'general', username: string) {
    await this.assertCompetitionAccess(competitionId, username, channel, false);
    return this.recent({ competitionId, channel, teamId: IsNull() });
  }

  async listTeam(teamId: string, username: string) {
    const team = await this.assertTeamAccess(teamId, username);
    return this.recent({ competitionId: team.competitionId, channel: 'team', teamId });
  }

  async postCompetition(competitionId: string, channel: 'announcements' | 'general', username: string, body: string) {
    await this.assertCompetitionAccess(competitionId, username, channel, true);
    return this.post({ competitionId, teamId: null, channel, authorUsername: username }, body);
  }

  async postTeam(teamId: string, username: string, body: string) {
    const team = await this.assertTeamAccess(teamId, username);
    return this.post({ competitionId: team.competitionId, teamId, channel: 'team', authorUsername: username }, body);
  }

  private async post(scope: Pick<ChatMessageEntity, 'competitionId' | 'teamId' | 'channel' | 'authorUsername'>, body: string) {
    const clean = String(body || '').trim();
    if (!clean || clean.length > 1000) throw new BadRequestException('Enter a message of at most 1000 characters.');
    if (scope.channel !== 'general') return this.messages.save(this.messages.create({ ...scope, body: clean }));

    const saveWithLimit = async (repo: Repository<ChatMessageEntity>) => {
      const since = new Date(Date.now() - GENERAL_WINDOW_MS);
      const count = await repo.count({ where: { competitionId: scope.competitionId, channel: 'general', authorUsername: scope.authorUsername, createdAt: MoreThan(since) } });
      if (count >= GENERAL_LIMIT) throw new HttpException('General chat limit reached. Try again in 30 seconds.', HttpStatus.TOO_MANY_REQUESTS);
      return repo.save(repo.create({ ...scope, body: clean }));
    };
    if (!this.messages.manager) return saveWithLimit(this.messages);
    return this.messages.manager.transaction(async manager => {
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`chat:${scope.competitionId}:${scope.authorUsername}`]);
      return saveWithLimit(manager.getRepository(ChatMessageEntity));
    });
  }
}
