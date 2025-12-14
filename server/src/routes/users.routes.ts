import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { authRequired, requirePermission } from '../auth/middleware.js';
import { hashPassword } from '../services/password.service.js';

export const usersRouter = Router();

usersRouter.use(authRequired);

usersRouter.get('/', requirePermission('users:read'), async (_req, res) => {
  const users = await prisma.user.findMany({
    select: { id: true, nome: true, email: true, papel: true, ativo: true, criadoEm: true },
    orderBy: { criadoEm: 'desc' },
  });
  res.json(users);
});

usersRouter.post('/', requirePermission('users:write'), async (req, res, next) => {
  try {
    const body = z
      .object({
        nome: z.string().min(1),
        email: z.string().email(),
        senha: z.string().min(6),
        papel: z.enum(['ADMIN', 'GERENTE', 'ATENDENTE', 'CAIXA']),
        ativo: z.boolean().optional(),
      })
      .parse(req.body);

    const created = await prisma.user.create({
      data: {
        nome: body.nome,
        email: body.email,
        hashSenha: await hashPassword(body.senha),
        papel: body.papel,
        ativo: body.ativo ?? true,
      },
      select: { id: true, nome: true, email: true, papel: true, ativo: true, criadoEm: true },
    });

    res.status(201).json(created);
  } catch (e) {
    next(e);
  }
});

usersRouter.patch('/:id', requirePermission('users:write'), async (req, res, next) => {
  try {
    const params = z.object({ id: z.string().min(1) }).parse(req.params);
    const body = z
      .object({
        nome: z.string().min(1).optional(),
        papel: z.enum(['ADMIN', 'GERENTE', 'ATENDENTE', 'CAIXA']).optional(),
        ativo: z.boolean().optional(),
        senha: z.string().min(6).optional(),
      })
      .parse(req.body);

    const updated = await prisma.user.update({
      where: { id: params.id },
      data: {
        nome: body.nome,
        papel: body.papel,
        ativo: body.ativo,
        hashSenha: body.senha ? await hashPassword(body.senha) : undefined,
      },
      select: { id: true, nome: true, email: true, papel: true, ativo: true, criadoEm: true },
    });

    res.json(updated);
  } catch (e) {
    next(e);
  }
});
