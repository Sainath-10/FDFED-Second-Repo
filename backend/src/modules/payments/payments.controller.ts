import { LifecycleService } from './lifecycle.service';
import { Body, Controller, Get, Headers, Param, ParseUUIDPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import { IsBoolean, IsIn, IsInt, IsNotEmpty, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/decorators/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/interfaces';
import { PaymentsService } from './payments.service';

class TransactionQuery {
  @Type(() => Number) @IsInt() @Min(1) @Max(100000) page: number = 1;
}
class MockPaymentDto {
  @IsIn(['success', 'failed']) outcome: 'success' | 'failed';
}
class HoldDto {
  @IsBoolean() held: boolean;
  @IsString() @IsNotEmpty() @MaxLength(2000) reason: string;
}
class SubscriptionDto { @IsBoolean() enabled: boolean; }
class TrustDto {
  @IsInt() @Min(0) @Max(100) score: number;
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString() @MinLength(10) @MaxLength(2000) reason: string;
}
class ReviewDto {
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString() @IsNotEmpty() @MaxLength(2000) note: string;
}
@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService, private readonly lifecycle: LifecycleService) {}

  @Post('webhook/razorpay')
  webhook(@Req() req: any, @Headers('x-razorpay-signature') signature: string) { return this.payments.webhook(req.rawBody, signature); }

  @Post('competitions/:id/initiate-platform-fee') @UseGuards(JwtAuthGuard)
  initiate(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) { return this.payments.initiatePlatformFee(id, req.user.username); }

  @Post('competitions/:id/mock-payment') @UseGuards(JwtAuthGuard)
  simulate(@Param('id', ParseUUIDPipe) id: string, @Req() req: any, @Body() dto: MockPaymentDto) { return this.payments.simulate(id, req.user.username, dto.outcome); }

  @Get('competitions/:id/status') @UseGuards(JwtAuthGuard)
  status(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) { return this.payments.status(id, req.user); }

  @Get('transactions') @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.FINANCE_MODERATOR, UserRole.REVENUE_ADMIN, UserRole.SUPER_ADMIN)
  transactions(@Query() query: TransactionQuery) { return this.payments.transactions(query.page); }

  @Post('transactions/:id/review') @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.FINANCE_MODERATOR, UserRole.REVENUE_ADMIN, UserRole.SUPER_ADMIN)
  review(@Param('id', ParseUUIDPipe) id: string, @Req() req: any, @Body() dto: ReviewDto) { return this.payments.review(id, req.user.username, dto.note); }
  @Post('competitions/:id/pay-prize-pool') @UseGuards(JwtAuthGuard)
  prize(@Param('id', ParseUUIDPipe) id: string, @Req() req: any, @Body() dto: MockPaymentDto) { return this.lifecycle.prize(id, req.user, dto.outcome); }

  @Get('competitions/:id/ledger') @UseGuards(JwtAuthGuard)
  ledger(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) { return this.lifecycle.summary(id, req.user); }

  @Post('competitions/:id/end') @UseGuards(JwtAuthGuard)
  end(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) { return this.lifecycle.end(id, req.user); }

  @Post('competitions/:id/cancel') @UseGuards(JwtAuthGuard)
  cancel(@Param('id', ParseUUIDPipe) id: string, @Req() req: any, @Body() dto: ReviewDto) { return this.lifecycle.cancel(id, req.user, dto.note); }

  @Post('competitions/:id/settle') @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.FINANCE_MODERATOR, UserRole.REVENUE_ADMIN, UserRole.SUPER_ADMIN)
  settle(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) { return this.lifecycle.settle(id, req.user); }

  @Post('competitions/:id/hold') @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.FINANCE_MODERATOR, UserRole.REVENUE_ADMIN, UserRole.SUPER_ADMIN)
  hold(@Param('id', ParseUUIDPipe) id: string, @Req() req: any, @Body() dto: HoldDto) { return this.lifecycle.hold(id, req.user, dto.held, dto.reason); }

  @Post('competitions/:id/release-held-prize') @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.FINANCE_MODERATOR, UserRole.REVENUE_ADMIN, UserRole.SUPER_ADMIN)
  heldPrize(@Param('id', ParseUUIDPipe) id: string, @Req() req: any, @Body() dto: ReviewDto) { return this.lifecycle.releaseHeldPrize(id, req.user, dto.note); }

  @Post('competitions/:id/reverse') @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.FINANCE_MODERATOR, UserRole.REVENUE_ADMIN, UserRole.SUPER_ADMIN)
  reverse(@Param('id', ParseUUIDPipe) id: string, @Req() req: any, @Body() dto: ReviewDto) { return this.lifecycle.reverse(id, req.user, dto.note); }

  @Post('competitions/:id/organizer-trust') @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.FINANCE_MODERATOR, UserRole.REVENUE_ADMIN, UserRole.SUPER_ADMIN)
  reviewTrust(@Param('id', ParseUUIDPipe) id: string, @Req() req: any, @Body() dto: TrustDto) { return this.lifecycle.reviewTrust(id, req.user, dto.score, dto.reason); }

  // Mock-mode testing tools (LifecycleService rejects them outside mock mode / in production).
  @Post('competitions/:id/mock/start-now') @UseGuards(JwtAuthGuard)
  startNow(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) { return this.lifecycle.mockStartNow(id, req.user); }

  @Post('competitions/:id/mock/close-dispute-window') @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.FINANCE_MODERATOR, UserRole.REVENUE_ADMIN, UserRole.SUPER_ADMIN)
  closeDisputeWindow(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) { return this.lifecycle.mockCloseDisputeWindow(id, req.user); }

  @Post('mock/run-deadlines') @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.FINANCE_MODERATOR, UserRole.REVENUE_ADMIN, UserRole.SUPER_ADMIN)
  async runDeadlines() { await this.lifecycle.runDeadlinesNow(); return { ok: true }; }

  @Get('me') @UseGuards(JwtAuthGuard)
  mine(@Req() req: any) { return this.lifecycle.myPayments(req.user); }

  @Get('subscriptions') @UseGuards(JwtAuthGuard)
  subscription(@Req() req: any) { return this.lifecycle.subscription(req.user); }

  @Get('competitions') @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.FINANCE_MODERATOR, UserRole.REVENUE_ADMIN, UserRole.SUPER_ADMIN)
  competitions() { return this.lifecycle.competitions(); }

  @Get('mail') @UseGuards(JwtAuthGuard)
  mail(@Req() req: any) { return this.lifecycle.inbox(req.user); }

  @Post('subscriptions') @UseGuards(JwtAuthGuard)
  subscriptions(@Req() req: any, @Body() dto: SubscriptionDto) { return this.lifecycle.subscribe(req.user, dto.enabled); }

}
