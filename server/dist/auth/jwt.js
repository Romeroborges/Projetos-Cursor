import jwt from 'jsonwebtoken';
import { env } from '../env.js';
export function signJwt(payload) {
    // `jsonwebtoken` tipa `expiresIn` como `StringValue | number` (ms). Nosso env vem como `string`.
    const expiresIn = env.JWT_EXPIRES_IN;
    return jwt.sign(payload, env.JWT_SECRET, { expiresIn });
}
export function verifyJwt(token) {
    return jwt.verify(token, env.JWT_SECRET);
}
