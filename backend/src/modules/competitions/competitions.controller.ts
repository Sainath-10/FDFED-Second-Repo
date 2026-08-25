import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  HttpCode,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiSecurity } from '@nestjs/swagger';
import { CompetitionsService } from './competitions.service';
import { CreateCompetitionDto, UpdateCompetitionDto, CompetitionResponseDto } from './dto/competition.dto';
import { HeaderAuthGuard } from '@/common/decorators/header-auth.guard';
import { RolesGuard } from '@/common/decorators/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { UserRole } from '@/common/interfaces';

@Controller('competitions')
@ApiTags('Competitions')
@ApiSecurity('x-user-role')
export class CompetitionsController {
  constructor(private competitionsService: CompetitionsService) {}

  @Post()
  @UseGuards(HeaderAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @HttpCode(201)
  @ApiOperation({
    summary: 'Create a new competition',
    description: 'Only Admins and Super Admins can create competitions',
  })
  @ApiResponse({
    status: 201,
    description: 'Competition successfully created',
    type: CompetitionResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Missing or invalid x-user-role header',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin role required',
  })
  async createCompetition(
    @Body() createCompetitionDto: CreateCompetitionDto,
  ): Promise<CompetitionResponseDto> {
    return this.competitionsService.createCompetition(createCompetitionDto);
  }

  @Get()
  @UseGuards(HeaderAuthGuard)
  @ApiOperation({
    summary: 'Get all competitions',
    description: 'Retrieve a list of all competitions',
  })
  @ApiResponse({
    status: 200,
    description: 'List of competitions',
    type: [CompetitionResponseDto],
  })
  async getAllCompetitions(): Promise<CompetitionResponseDto[]> {
    return this.competitionsService.getAllCompetitions();
  }

  @Get('active')
  @UseGuards(HeaderAuthGuard)
  @ApiOperation({
    summary: 'Get active competitions',
    description: 'Retrieve only active competitions',
  })
  @ApiResponse({
    status: 200,
    description: 'List of active competitions',
    type: [CompetitionResponseDto],
  })
  async getActiveCompetitions(): Promise<CompetitionResponseDto[]> {
    return this.competitionsService.getActiveCompetitions();
  }

  @Get(':id')
  @UseGuards(HeaderAuthGuard)
  @ApiOperation({
    summary: 'Get competition by ID',
    description: 'Retrieve a specific competition by its ID',
  })
  @ApiResponse({
    status: 200,
    description: 'Competition details',
    type: CompetitionResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Competition not found',
  })
  async getCompetition(@Param('id') id: string): Promise<CompetitionResponseDto> {
    const competition = await this.competitionsService.getCompetitionById(id);
    if (!competition) {
      throw new NotFoundException(`Competition with ID ${id} not found`);
    }
    return competition;
  }

  @Patch(':id')
  @UseGuards(HeaderAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Update a competition',
    description: 'Update competition details (Admin only)',
  })
  @ApiResponse({
    status: 200,
    description: 'Competition successfully updated',
    type: CompetitionResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Competition not found',
  })
  async updateCompetition(
    @Param('id') id: string,
    @Body() updateCompetitionDto: UpdateCompetitionDto,
  ): Promise<CompetitionResponseDto> {
    return this.competitionsService.updateCompetition(id, updateCompetitionDto);
  }

  @Delete(':id')
  @UseGuards(HeaderAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @HttpCode(204)
  @ApiOperation({
    summary: 'Delete a competition',
    description: 'Delete a competition (Super Admin only)',
  })
  @ApiResponse({
    status: 204,
    description: 'Competition successfully deleted',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Super Admin role required',
  })
  async deleteCompetition(@Param('id') id: string): Promise<void> {
    await this.competitionsService.deleteCompetition(id);
  }
}
