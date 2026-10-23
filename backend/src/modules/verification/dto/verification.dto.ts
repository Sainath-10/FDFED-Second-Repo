import { ApiProperty } from '@nestjs/swagger';

export class RequestOtpDto {
  @ApiProperty({ description: '12-digit Aadhaar number (simulated). Never stored in full.' })
  aadhaarNumber: string;
}

export class VerifyOtpDto {
  @ApiProperty({ description: 'OTP — any non-empty value completes the simulated flow. Never stored.' })
  otp: string;
}

export class VerificationStatusResponseDto {
  @ApiProperty({ enum: ['unverified', 'verified'] }) verificationStatus: string;
  @ApiProperty({ enum: ['unverified', 'verified'] }) organizerVerificationStatus: string;
  @ApiProperty({ required: false, nullable: true }) verifiedAt?: Date | null;
  @ApiProperty({ required: false, nullable: true }) aadhaarMasked?: string | null;
  @ApiProperty() simulated: boolean;
}
