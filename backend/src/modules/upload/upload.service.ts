import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import * as path from 'path';
import * as fs from 'fs';
import { UploadResponseDto } from './dto/upload-response.dto';

/** What a file really is, decided from its first bytes rather than the browser's claim. */
type Detected = { mime: string; ext: string };

export function detectFileType(head: Buffer): Detected | null {
  const starts = (bytes: number[], offset = 0) => bytes.every((b, i) => head[offset + i] === b);
  if (starts([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { mime: 'image/png', ext: '.png' };
  if (starts([0xff, 0xd8, 0xff])) return { mime: 'image/jpeg', ext: '.jpg' };
  if (starts([0x47, 0x49, 0x46, 0x38])) return { mime: 'image/gif', ext: '.gif' };
  if (starts([0x52, 0x49, 0x46, 0x46]) && starts([0x57, 0x45, 0x42, 0x50], 8)) return { mime: 'image/webp', ext: '.webp' };
  if (starts([0x25, 0x50, 0x44, 0x46, 0x2d])) return { mime: 'application/pdf', ext: '.pdf' };
  return null;
}

/** Plain text: valid UTF-8, no NUL bytes and nothing that looks like markup a browser would run. */
export function looksLikePlainText(content: Buffer): boolean {
  if (content.includes(0)) return false;
  const text = content.toString('utf8');
  if (Buffer.from(text, 'utf8').length !== content.length) return false;
  return !/<\s*(svg|script|html|iframe|!doctype)/i.test(text);
}

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

    const stored = path.join(this.uploadsDir, path.basename(file.filename));
    const content = fs.readFileSync(stored);
    let detected = detectFileType(content.subarray(0, 16));
    if (!detected && file.mimetype === 'text/plain' && looksLikePlainText(content)) {
      detected = { mime: 'text/plain', ext: '.txt' };
    }
    if (!detected || detected.mime !== (file.mimetype === 'image/jpg' ? 'image/jpeg' : file.mimetype)) {
      fs.rmSync(stored, { force: true });
      throw new BadRequestException('The file content does not match its type. Upload a real PNG, JPEG, WEBP, GIF, PDF or plain-text file.');
    }

    // Store under the extension of what the file really is, so it is always served with the right type.
    const base = path.basename(file.filename, path.extname(file.filename));
    const finalName = `${base}${detected.ext}`;
    if (finalName !== file.filename) fs.renameSync(stored, path.join(this.uploadsDir, finalName));

    return {
      filename: finalName,
      originalName: file.originalname,
      mimetype: detected.mime,
      size: file.size,
      url: `/upload/file/${finalName}`,
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
