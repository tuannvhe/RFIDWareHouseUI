const ACCESS_KEY = "rfid.accessToken";
const REFRESH_KEY = "rfid.refreshToken";
const USERNAME_KEY = "rfid.username";
const ROLES_KEY = "rfid.roles";

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_KEY);
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_KEY);
}

export function getUsername(): string | null {
  return localStorage.getItem(USERNAME_KEY);
}

export function getRoles(): string[] {
  const raw = localStorage.getItem(ROLES_KEY);
  return raw ? (JSON.parse(raw) as string[]) : [];
}

export function setSession(accessToken: string, refreshToken: string, username: string, roles: string[]) {
  localStorage.setItem(ACCESS_KEY, accessToken);
  localStorage.setItem(REFRESH_KEY, refreshToken);
  localStorage.setItem(USERNAME_KEY, username);
  localStorage.setItem(ROLES_KEY, JSON.stringify(roles));
}

// Backend xoay vong refresh token moi lan goi /api/auth/refresh (refresh token cu bi vo hieu ngay
// sau khi dung) - phai luu lai ca refresh token moi nay, neu khong lan refresh tiep theo se that bai.
export function setTokens(accessToken: string, refreshToken: string) {
  localStorage.setItem(ACCESS_KEY, accessToken);
  localStorage.setItem(REFRESH_KEY, refreshToken);
}

export function clearSession() {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(USERNAME_KEY);
  localStorage.removeItem(ROLES_KEY);
}
