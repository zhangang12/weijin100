/** JWT 载荷 */
export interface JwtPayload {
  sub: string; // userId
  openid: string;
  typ?: 'access' | 'refresh';
}

/** 注入到 req.user 的当前用户 */
export interface AuthUser {
  userId: string;
  openid: string;
}
