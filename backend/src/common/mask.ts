/** 脱敏工具：姓名/手机号/身份证。 */
export function maskName(name?: string | null): string {
  if (!name) return '';
  if (name.length <= 1) return name;
  return name[0] + '*'.repeat(Math.max(1, name.length - 1));
}

export function maskPhone(phone?: string | null): string {
  if (!phone) return '';
  const d = phone.replace(/\D/g, '');
  if (d.length < 7) return phone;
  return d.slice(0, 3) + '****' + d.slice(-4);
}

export function maskIdCard(no?: string | null): string {
  if (!no) return '';
  if (no.length < 8) return no;
  return no.slice(0, 4) + '*'.repeat(no.length - 8) + no.slice(-4);
}

/** 微金号/openid → 行展示用掩码（如 j*****6）。 */
export function maskUser(s?: string | null): string {
  if (!s) return '';
  if (s.length <= 2) return s[0] + '*';
  return s[0] + '*****' + s.slice(-1);
}
