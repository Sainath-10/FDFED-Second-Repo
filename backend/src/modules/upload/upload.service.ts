import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import * as path from 'path';
import * as fs from 'fs';
import { UploadResponseDto } from './dto/upload-response.dto';

@Injectable()
export class UploadService {
  private readonly uploadsDir = path.resolve(process.cwd(), 'uploads');

  constructor() {
    if (!fs.existsSync(this.uploadsDir)) {
      fs.mkdirSync(this.uploadsDir, { recursive: true });
    }
  }

  processUploadedFile(file: Express.Multer.File): UploadResponseDto {
    if (!file) {
      throw new BadRequestException('No file uploaded or file rejected by validator');
    }

    return {
      filename: file.filename,
      originalName: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      url: `/upload/file/${file.filename}`,
      message: 'File uploaded successfully',
    };
  }

  getFilePath(filename: string): string {
    // Sanitize filename to prevent directory traversal
    const safeFilename = path.basename(filename);
    const fullPath = path.join(this.uploadsDir, safeFilename);

    if (!fs.existsSync(fullPath)) {
      throw new NotFoundException(`File ${safeFilename} not found`);
    }

    return fullPath;
  }
}
