const TOKEN_KEY = 'barclube.token';
const USER_KEY = 'barclube.user';

export type SessionUser = {
  id: string;
  nome: string;
  email: string;
  papel: 'ADMIN' | 'GERENTE' | 'ATENDENTE' | 'CAIXA';
};

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setSession(token: string, user: SessionUser) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function getSessionUser(): SessionUser | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SessionUser;
  } catch {
    return null;
  }
}
