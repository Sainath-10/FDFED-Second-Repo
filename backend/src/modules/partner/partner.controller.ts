import {
  Controller,
  Get,
  Param,
  NotFoundException,
  HttpCode,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiSecurity,
  ApiParam,
} from '@nestjs/swagger';
import { PartnerService } from './partner.service';

/**
 * B2B Partner Controller
 *
 * These routes are for EXTERNAL partner systems (B2B consumers).
 * All routes require the x-api-key header (enforced by PartnerApiKeyMiddleware).
 *
 * This is separate from the B2C routes (/competitions, /teams, etc.)
 * which are designed for end-user frontend consumption.
 */
@Controller('partner')
@ApiTags('Partner')
@ApiSecurity('x-api-key')
export class PartnerController {
  constructor(private readonly partnerService: PartnerService) {}

  /**
   * B2B Expose — List active competitions for external partners
   */
  @Get('competitions')
  @HttpCode(200)
  @ApiOperation({
    summary: '[B2B] Get all active competitions',
    description:
      'External partner systems use this endpoint to pull a feed of all active competitions. ' +
      'Requires x-api-key header for B2B authentication.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of active competitions for partner consumption',
  })
  @ApiResponse({
    status: 401,
    description: 'Missing or invalid x-api-key',
  })
  async getActiveCompetitions() {
    const competitions = await this.partnerService.getActiveCompetitions();
    return {
      source: 'FDFED-B2B-Partner-API',
      authType: 'API-Key',
      count: competitions.length,
      competitions,
    };
  }

  /**
   * B2B Expose — Get single competition with enriched stats
   */
  @Get('competitions/:id')
  @HttpCode(200)
  @ApiOperation({
    summary: '[B2B] Get competition details with team and dispute stats',
    description:
      'Returns competition details enriched with aggregated team count and dispute count ' +
      '— useful for partner dashboards and analytics systems.',
  })
  @ApiParam({ name: 'id', description: 'Competition UUID' })
  @ApiResponse({
    status: 200,
    description: 'Competition details with stats',
  })
  @ApiResponse({
    status: 404,
    description: 'Competition not found',
  })
  async getCompetition(@Param('id') id: string) {
    const competition = await this.partnerService.getCompetitionById(id);
    if (!competition) {
      throw new NotFoundException(`Competition ${id} not found`);
    }
    return {
      source: 'FDFED-B2B-Partner-API',
      authType: 'API-Key',
      competition,
    };
  }

  /**
   * B2B Expose — Platform-wide statistics for partner dashboards
   */
  @Get('stats')
  @HttpCode(200)
  @ApiOperation({
    summary: '[B2B] Get platform-wide statistics',
    description:
      'Aggregated platform statistics for partner analytics and reporting systems. ' +
      'Includes competition counts, team counts, dispute breakdowns.',
  })
  @ApiResponse({
    status: 200,
    description: 'Platform statistics',
  })
  async getPlatformStats() {
    return this.partnerService.getPlatformStats();
  }
}
