import { ApiProperty } from '@nestjs/swagger';

export class UploadResponseDto {
  @ApiProperty({ example: 'screenshot-12345.png' })
  filename: string;

  @ApiProperty({ example: 'screenshot.png' })
  originalName: string;

  @ApiProperty({ example: 'image/png' })
  mimetype: string;

  @ApiProperty({ example: 1048576 })
  size: number;

  @ApiProperty({ example: '/upload/file/screenshot-12345.png' })
  url: string;

  @ApiProperty({ example: 'File uploaded successfully' })
  message: string;
}
