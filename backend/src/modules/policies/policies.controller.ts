import { Controller, Get, Post, Patch, Delete, Param, Body, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { PoliciesService } from './policies.service';

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
  @ApiOperation({ summary: 'Create a new policy (Super Admin only)' })
  async create(
    @Body() body: { title: string; content: string; category?: string; version?: string; createdBy: string; compliance?: number },
  ) {
    return this.service.create(body);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a policy (Super Admin only)' })
  async update(@Param('id') id: string, @Body() body: any) {
    return this.service.update(id, body);
  }

  @Patch(':id/archive')
  @ApiOperation({ summary: 'Archive a policy' })
  async archive(@Param('id') id: string) {
    return this.service.archive(id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a policy (Super Admin only)' })
  async delete(@Param('id') id: string) {
    await this.service.delete(id);
    return { message: 'Policy deleted' };
  }
}
