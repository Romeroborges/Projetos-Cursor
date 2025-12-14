import jwt from 'jsonwebtoken';
import { env } from '../env.js';
import type { Role } from './roles.js';

export type JwtPayload = {
  sub: string;
  role: Role;
};

export function signJwt(payload: JwtPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN });
}

export function verifyJwt(token: string): JwtPayload {
  return jwt.verify(token, env.JWT_SECRET) as JwtPayload;
}
