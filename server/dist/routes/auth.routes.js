import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { HttpError } from '../types.js';
import { verifyPassword } from '../services/password.service.js';
import { signJwt } from '../auth/jwt.js';
export const authRouter = Router();
authRouter.post('/login', async (req, res, next) => {
    try {
        const body = z
            .object({
            email: z.string().email(),
            senha: z.string().min(1),
        })
            .parse(req.body);
        const user = await prisma.user.findUnique({ where: { email: body.email } });
        if (!user || !user.ativo)
            throw new HttpError(401, 'INVALID_CREDENTIALS');
        const ok = await verifyPassword(body.senha, user.hashSenha);
        if (!ok)
            throw new HttpError(401, 'INVALID_CREDENTIALS');
        const token = signJwt({ sub: user.id, role: user.papel });
        res.json({
            token,
            user: {
                id: user.id,
                nome: user.nome,
                email: user.email,
                papel: user.papel,
            },
        });
    }
    catch (e) {
        next(e);
    }
});
