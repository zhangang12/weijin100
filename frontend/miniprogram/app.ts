import { restoreSession } from './utils/auth';

export interface GlobalData {
  token: string | null;
  user: WechatMiniprogram.IAnyObject | null;
}

App<{ globalData: GlobalData }>({
  globalData: {
    token: null,
    user: null,
  },
  onLaunch() {
    // 游客可浏览，不强制登录；此处仅恢复本地会话态
    restoreSession();
  },
});
