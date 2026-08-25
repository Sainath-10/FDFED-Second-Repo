import {
  Controller,
  Post,
  Get,
  Param,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Res,
  HttpCode,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiConsumes, ApiBody, ApiResponse } from '@nestjs/swagger';
import { diskStorage } from 'multer';
import * as path from 'path';
import { Response } from 'express';
import { UploadService } from './upload.service';
import { UploadResponseDto } from './dto/upload-response.dto';

const storage = diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.resolve(process.cwd(), 'uploads'));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const cleanName = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '');
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `${cleanName}-${uniqueSuffix}${ext}`);
  },
});

const fileFilter = (req: any, file: Express.Multer.File, cb: any) => {
  const allowedMimeTypes = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'application/pdf',
    'text/plain',
  ];

  if (!allowedMimeTypes.includes(file.mimetype)) {
    return cb(
      new BadRequestException(
        `Invalid file type '${file.mimetype}'. Allowed types: JPEG, PNG, WEBP, GIF, PDF, TXT`,
      ),
      false,
    );
  }
  cb(null, true);
};

@Controller('upload')
@ApiTags('Upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post('file')
  @HttpCode(201)
  @ApiOperation({
    summary: 'Upload a file',
    description: 'Upload an image, document, or dispute evidence (Max: 5MB, Allowed: PNG, JPG, WEBP, GIF, PDF, TXT)',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'The file to upload',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'File uploaded successfully',
    type: UploadResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid file type or size exceeded',
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage,
      fileFilter,
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB maximum file size
      },
    }),
  )
  uploadFile(@UploadedFile() file: Express.Multer.File): UploadResponseDto {
    return this.uploadService.processUploadedFile(file);
  }

  @Get('file/:filename')
  @ApiOperation({
    summary: 'Get uploaded file',
    description: 'Retrieve or view a previously uploaded file by filename',
  })
  @ApiResponse({
    status: 200,
    description: 'File content stream',
  })
  @ApiResponse({
    status: 404,
    description: 'File not found',
  })
  getFile(@Param('filename') filename: string, @Res() res: Response): void {
    const filePath = this.uploadService.getFilePath(filename);
    res.sendFile(filePath);
  }
}
