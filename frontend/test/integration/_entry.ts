// esbuild 打包入口：把前端「真实」的网络/鉴权/api/guard 层聚合导出，供 Node 联调 harness 调用。
export * from '../../miniprogram/api/index';
export { ensureLogin, clearSession, getToken } from '../../miniprogram/utils/auth';
export { requireEligibility } from '../../miniprogram/utils/guard';
export { BizError } from '../../miniprogram/utils/request';
