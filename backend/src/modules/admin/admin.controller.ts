import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  UseGuards,
  HttpCode,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiSecurity, ApiBearerAuth } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { CreateAdminDto, UpdateUserRoleDto } from './dto/admin.dto';
import { HeaderAuthGuard } from '@/common/decorators/header-auth.guard';
import { RolesGuard } from '@/common/decorators/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { UserRole } from '@/common/interfaces';

@Controller('admin')
@ApiTags('Admin')
@ApiSecurity('x-user-role')
@ApiBearerAuth()
export class AdminController {
  constructor(private adminService: AdminService) {}

  @Get('users')
  @UseGuards(HeaderAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Get all platform users',
    description: 'Retrieve a list of all registered platform users (Admin & Super Admin only).',
  })
  async getAllUsers() {
    return this.adminService.getAllUsers();
  }

  @Post('users')
  @UseGuards(HeaderAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @HttpCode(201)
  @ApiOperation({
    summary: 'Create a new Admin account',
    description: 'Super Admin exclusive action to create a new Administrator or Super Admin.',
  })
  async createAdmin(@Body() dto: CreateAdminDto) {
    return this.adminService.createAdminUser(dto);
  }

  @Patch('users/:id/role')
  @UseGuards(HeaderAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Update a user role',
    description: 'Super Admin exclusive action to promote or demote user roles.',
  })
  async updateUserRole(
    @Param('id') id: string,
    @Body() dto: UpdateUserRoleDto,
  ) {
    return this.adminService.updateUserRole(id, dto.role);
  }

  @Get('stats')
  @UseGuards(HeaderAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Get aggregate admin dashboard statistics',
    description: 'Retrieves tournament counts, user counts, dispute counts, and revenue stats.',
  })
  async getAdminStats() {
    return this.adminService.getAdminStats();
  }
}
