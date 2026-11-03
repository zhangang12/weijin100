import { Injectable } from '@nestjs/common';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { ConfigService } from '../../config/config.service';

/**
 * 文件存储服务（架构 v2：本地落盘 /data/uploads，取消 OSS）。
 * 对外只暴露 key（相对路径），DB 存 key 不存绝对路径——保留这层抽象，
 * 将来加 OssDriver 即可切换，业务代码无感。
 */
@Injectable()
export class StorageService {
  constructor(private readonly config: ConfigService) {}

  /** 保存文件，返回相对 key（如 kyc/2026-06-28/169..._ab12.jpg）。 */
  async save(buf: Buffer, opts: { dir: string; ext?: string }): Promise<string> {
    const day = new Date().toISOString().slice(0, 10);
    const name = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}${opts.ext || ''}`;
    const key = path.posix.join(opts.dir, day, name);
    const abs = path.join(this.config.uploadDir, key);
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, buf);
    return key;
  }

  /** 读取文件流（证件类走鉴权下载接口，不公开 URL）。key 必须落在上传目录内，防路径穿越。 */
  async read(key: string): Promise<Buffer> {
    const root = path.resolve(this.config.uploadDir);
    const abs = path.resolve(root, key);
    if (!abs.startsWith(root + path.sep)) throw new Error('invalid key');
    return fs.readFile(abs);
  }

  absPath(key: string): string {
    return path.join(this.config.uploadDir, key);
  }
}
