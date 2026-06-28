import type { Response } from 'express';

function rid(): string {
  return Math.random().toString(36).slice(2, 10);
}

/** 统一成功响应（对齐《接口文档 v0.1》§1.3） */
export function ok<T>(res: Response, data: T): void {
  res.json({ code: 0, bizCode: 'OK', message: '成功', data, requestId: rid() });
}

/** 统一失败响应 */
export function fail(res: Response, code: number, message: string, bizCode = 'ERROR'): void {
  res.json({ code, bizCode, message, data: null, requestId: rid() });
}
