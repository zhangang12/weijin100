import { Controller, Get, Post, Req, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { StorageService } from './storage.service';
import { ConfigService } from '../../config/config.service';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { AdminGuard } from '../../common/auth/admin.guard';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import type { AuthUser } from '../../common/auth/jwt-payload';
import { BizException } from '../../common/biz-exception';
import * as path from 'node:path';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Request = any;
type Response = any;

/** 公开目录：nginx 直出 /uploads/<dir>/，返回可直接展示的 url。 */
const PUBLIC_DIRS = ['listing', 'avatar'];
/** 私密目录：证件 / 仲裁证据 / 申诉材料，只能本人或运营端（x-admin-token）下载。 */
const PRIVATE_DIRS = ['kyc', 'arb', 'appeal'];
const MAX_SIZE = 10 * 1024 * 1024; // 单张 ≤10MB（F8）
const EXT_BY_MIME: Record<string, string> = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };
const MIME_BY_EXT: Record<string, string> = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };

@Controller()
export class StorageController {
  constructor(
    private readonly storage: StorageService,
    private readonly config: ConfigService,
  ) {}

  /**
   * POST /upload?dir=listing|avatar|kyc|arb|appeal
   * - multipart/form-data（field: file）：小程序 wx.uploadFile
   * - 或直接以 image/* 作为请求体（脚本/测试用）
   * 返回 { fileId, url? }：fileId = <dir>/<userId>/<日期>/<文件名>；公开目录另给可展示的 url。
   */
  @UseGuards(JwtAuthGuard)
  @Post('upload')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_SIZE } }))
  async upload(
    @Req() req: Request,
    @CurrentUser() u: AuthUser,
    @UploadedFile() file?: { buffer: Buffer; mimetype: string; originalname: string },
  ): Promise<{ fileId: string; url?: string }> {
    const dir = String(req.query['dir'] || '');
    if (![...PUBLIC_DIRS, ...PRIVATE_DIRS].includes(dir)) throw new BizException('不支持的上传目录', 'UPLOAD_DIR', 2000);

    let buf: Buffer;
    let mime: string;
    if (file) {
      buf = file.buffer;
      mime = file.mimetype;
      // 部分机型 wx.uploadFile 传 application/octet-stream，按文件名后缀兜底
      if (!EXT_BY_MIME[mime]) mime = MIME_BY_EXT[path.extname(file.originalname || '').toLowerCase()] || mime;
    } else {
      mime = String(req.headers['content-type'] || '').split(';')[0].trim();
      buf = await readBody(req, MAX_SIZE);
    }
    const ext = EXT_BY_MIME[mime];
    if (!ext) throw new BizException('仅支持 jpg/png 图片', 'UPLOAD_TYPE', 2000);
    if (!buf.length) throw new BizException('文件为空', 'UPLOAD_EMPTY', 2000);

    const fileId = await this.storage.save(buf, { dir: `${dir}/${u.userId}`, ext });
    return PUBLIC_DIRS.includes(dir) ? { fileId, url: `${this.config.publicBaseUrl}/uploads/${fileId}` } : { fileId };
  }

  /** GET /file/*：本人下载自己上传的文件（证件照、仲裁证据等）。 */
  @UseGuards(JwtAuthGuard)
  @Get('file/*')
  async download(@Req() req: Request, @Res() res: Response, @CurrentUser() u: AuthUser) {
    const key = String(req.params[0] || '');
    if (key.split('/')[1] !== u.userId) return res.status(403).json({ code: 403, message: '无权查看该文件' });
    return this.send(key, res);
  }

  /** GET /admin/file/*：运营审核实名、处理仲裁/申诉时查看任意用户的材料。 */
  @UseGuards(AdminGuard)
  @Get('admin/file/*')
  async adminDownload(@Req() req: Request, @Res() res: Response) {
    return this.send(String(req.params[0] || ''), res);
  }

  private async send(key: string, res: Response) {
    try {
      const buf = await this.storage.read(key);
      res.setHeader('Content-Type', MIME_BY_EXT[path.extname(key).toLowerCase()] || 'application/octet-stream');
      res.send(buf);
    } catch {
      res.status(404).json({ code: 404, message: '文件不存在' });
    }
  }
}

/** 读原始请求体（非 multipart 上传），超限即中止。 */
function readBody(req: Request, limit: number): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > limit) {
        reject(new BizException('图片不能超过 10MB', 'UPLOAD_SIZE', 2000));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}
