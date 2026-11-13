import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { PoliciesService } from './policies.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/decorators/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/interfaces';
import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class CreatePolicyDto {
  @ApiProperty() @IsString() @MinLength(3) @MaxLength(200) title: string;
  @ApiProperty() @IsString() @MinLength(10) @MaxLength(50000) content: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(60) category?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(20) version?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsNumber() @Min(0) @Max(100) compliance?: number;
  @ApiProperty({ required: false }) @IsOptional() @IsBoolean() active?: boolean;
  @ApiProperty({ required: false, description: 'Ignored: the author comes from the token' })
  @IsOptional() @IsString() @MaxLength(60) createdBy?: string;
}

export class UpdatePolicyDto extends PartialType(CreatePolicyDto) {}

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
    @Body() body: CreatePolicyDto,
  ) {
    const createdBy = req.user.username;
    return this.service.create({ ...body, createdBy });
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a policy (Super Admin / Admin only)' })
  async update(@Param('id') id: string, @Body() body: UpdatePolicyDto) {
    const { createdBy: _ignored, ...updates } = body;
    return this.service.update(id, updates);
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

