import type { Request, Response, NextFunction } from 'express';
import { HttpError } from '../types.js';
import { verifyJwt } from './jwt.js';
import { hasPermission, type Permission } from './roles.js';

export type AuthenticatedUser = {
  id: string;
  role: 'ADMIN' | 'GERENTE' | 'ATENDENTE' | 'CAIXA';
};

declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthenticatedUser;
  }
}

export function authRequired(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return next(new HttpError(401, 'UNAUTHORIZED'));

  const token = header.slice('Bearer '.length);
  try {
    const payload = verifyJwt(token);
    req.user = { id: payload.sub, role: payload.role };
    return next();
  } catch {
    return next(new HttpError(401, 'UNAUTHORIZED'));
  }
}

export function requirePermission(perm: Permission) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(new HttpError(401, 'UNAUTHORIZED'));
    if (!hasPermission(req.user.role, perm)) return next(new HttpError(403, 'FORBIDDEN'));
    return next();
  };
}
