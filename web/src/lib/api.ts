import { clearSession, getToken } from './auth';

const API_URL = (import.meta as any).env?.VITE_API_URL ?? 'http://localhost:3001';

export class ApiError extends Error {
  status: number;
  details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();

  const headers = new Headers(init?.headers ?? undefined);
  headers.set('Accept', 'application/json');
  if (!(init?.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers,
  });

  const isJson = (res.headers.get('content-type') ?? '').includes('application/json');
  const body = isJson ? await res.json().catch(() => null) : await res.text().catch(() => null);

  if (res.status === 401) {
    clearSession();
  }

  if (!res.ok) {
    const msg = (body && typeof body === 'object' && 'error' in body && (body as any).error) ? String((body as any).error) : `HTTP_${res.status}`;
    const details = body && typeof body === 'object' && 'details' in body ? (body as any).details : body;
    throw new ApiError(res.status, msg, details);
  }

  return body as T;
}
