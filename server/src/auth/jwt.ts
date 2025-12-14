import jwt from 'jsonwebtoken';
import { env } from '../env.js';
import type { Role } from './roles.js';

export type JwtPayload = {
  sub: string;
  role: Role;
};

export function signJwt(payload: JwtPayload): string {
  // `jsonwebtoken` tipa `expiresIn` como `StringValue | number` (ms). Nosso env vem como `string`.
  const expiresIn = env.JWT_EXPIRES_IN as unknown as jwt.SignOptions['expiresIn'];
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn });
}

export function verifyJwt(token: string): JwtPayload {
  return jwt.verify(token, env.JWT_SECRET) as JwtPayload;
}
