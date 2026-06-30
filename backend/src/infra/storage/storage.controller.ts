import { Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import { StorageService } from './storage.service';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import * as path from 'node:path';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Request = any;
type Response = any;

@Controller()
export class StorageController {
  constructor(private readonly storage: StorageService) {}

  /**
   * POST /upload?dir=kyc|arb|misc
   * Content-Type: multipart/form-data  (field: file)
   * 返回: { fileId: string }
   */
  @UseGuards(JwtAuthGuard)
  @Post('upload')
  async upload(@Req() req: Request): Promise<{ fileId: string }> {
    // NestJS 默认不处理 multipart；用原生 stream 收字节
    const dir = (req.query['dir'] as string) || 'misc';
    const chunks: Buffer[] = [];
    await new Promise<void>((resolve, reject) => {
      req.on('data', (chunk: Buffer) => chunks.push(chunk));
      req.on('end', resolve);
      req.on('error', reject);
    });
    const buf = Buffer.concat(chunks);
    // 从 Content-Type 提取 ext（简单版本；生产可用 busboy）
    const ct = req.headers['content-type'] || '';
    const extMap: Record<string, string> = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };
    const ext = extMap[ct.split(';')[0].trim()] || '';
    const fileId = await this.storage.save(buf, { dir, ext });
    return { fileId };
  }

  /**
   * GET /file/*
   * 鉴权下载保护文件（证件照、仲裁证据等）
   * Express 4 通配符用 req.params[0] 取路径
   */
  @UseGuards(JwtAuthGuard)
  @Get('file/*')
  async download(@Req() req: Request, @Res() res: Response) {
    const key: string = (req as any).params[0] as string;
    try {
      const buf = await this.storage.read(key);
      const ext = path.extname(key).toLowerCase();
      const mimeMap: Record<string, string> = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };
      res.setHeader('Content-Type', mimeMap[ext] || 'application/octet-stream');
      res.send(buf);
    } catch {
      res.status(404).json({ code: 404, message: '文件不存在' });
    }
  }
}
