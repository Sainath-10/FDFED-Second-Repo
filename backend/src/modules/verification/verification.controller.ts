import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Request,
  HttpCode,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { IsString } from 'class-validator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { VerificationService } from './verification.service';
import { RequestOtpDto, VerifyOtpDto, VerificationStatusResponseDto } from './dto/verification.dto';

export class AadhaarRequestDto {
  @IsString()
  aadhaarNumber: string;
}

export class AadhaarVerifyDto {
  @IsString()
  otp: string;
}

@ApiTags('Verification')
@ApiBearerAuth()
@Controller('verification')
export class VerificationController {
  constructor(private verificationService: VerificationService) {}

  @Get('status')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get current user verification status (mock/simulated Aadhaar flow)' })
  async getStatus(@Request() req: any): Promise<VerificationStatusResponseDto> {
    return this.verificationService.getStatus(req.user.id, req.user.username);
  }

  @Post('aadhaar/request-otp')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  @ApiOperation({ summary: 'Simulated step 1: validate 12-digit Aadhaar format (no real UIDAI call)' })
  async requestOtp(@Request() req: any, @Body() dto: AadhaarRequestDto) {
    return this.verificationService.requestOtp(req.user.id, dto.aadhaarNumber);
  }

  @Post('aadhaar/verify')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  @ApiOperation({ summary: 'Simulated step 2: complete mock verification with a non-empty OTP' })
  async verify(@Request() req: any, @Body() dto: AadhaarVerifyDto) {
    return this.verificationService.verify(req.user.id, dto.otp);
  }
}
