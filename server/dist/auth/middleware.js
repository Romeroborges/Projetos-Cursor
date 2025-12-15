import { HttpError } from '../types.js';
import { verifyJwt } from './jwt.js';
import { hasPermission } from './roles.js';
export function authRequired(req, _res, next) {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer '))
        return next(new HttpError(401, 'UNAUTHORIZED'));
    const token = header.slice('Bearer '.length);
    try {
        const payload = verifyJwt(token);
        req.user = { id: payload.sub, role: payload.role };
        return next();
    }
    catch {
        return next(new HttpError(401, 'UNAUTHORIZED'));
    }
}
export function requirePermission(perm) {
    return (req, _res, next) => {
        if (!req.user)
            return next(new HttpError(401, 'UNAUTHORIZED'));
        if (!hasPermission(req.user.role, perm))
            return next(new HttpError(403, 'FORBIDDEN'));
        return next();
    };
}
