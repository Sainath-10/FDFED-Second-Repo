import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { PoliciesService } from './policies.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/decorators/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/interfaces';

@Controller('policies')
@ApiTags('Policies')
export class PoliciesController {
  constructor(private readonly service: PoliciesService) {}

  @Get()
  @ApiOperation({ summary: 'Get all platform policies' })
  @ApiQuery({ name: 'active', required: false, type: Boolean })
  async findAll(@Query('active') active?: string) {
    return this.service.findAll(active === 'true');
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a policy by ID' })
  async findOne(@Param('id') id: string) {
    return this.service.findById(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new policy (Super Admin / Admin only)' })
  async create(
    @Request() req: any,
    @Body() body: { title: string; content: string; category?: string; version?: string; createdBy?: string; compliance?: number },
  ) {
    const createdBy = req.user?.username || body.createdBy || 'superadmin';
    return this.service.create({ ...body, createdBy });
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a policy (Super Admin / Admin only)' })
  async update(@Param('id') id: string, @Body() body: any) {
    return this.service.update(id, body);
  }

  @Patch(':id/archive')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Archive a policy (Super Admin / Admin only)' })
  async archive(@Param('id') id: string) {
    return this.service.archive(id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a policy (Super Admin only)' })
  async delete(@Param('id') id: string) {
    await this.service.delete(id);
    return { message: 'Policy deleted' };
  }
}

