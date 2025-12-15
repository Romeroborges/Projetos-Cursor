import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { authRequired, requirePermission } from '../auth/middleware.js';
export const tablesRouter = Router();
tablesRouter.use(authRequired);
tablesRouter.get('/', requirePermission('tables:read'), async (_req, res) => {
    const tables = await prisma.table.findMany({ orderBy: { nomeOuNumero: 'asc' } });
    res.json(tables);
});
tablesRouter.post('/', requirePermission('tables:write'), async (req, res, next) => {
    try {
        const body = z.object({ nomeOuNumero: z.string().min(1) }).parse(req.body);
        const table = await prisma.table.create({ data: { nomeOuNumero: body.nomeOuNumero } });
        res.status(201).json(table);
    }
    catch (e) {
        next(e);
    }
});
tablesRouter.patch('/:id', requirePermission('tables:write'), async (req, res, next) => {
    try {
        const params = z.object({ id: z.string().min(1) }).parse(req.params);
        const body = z
            .object({
            nomeOuNumero: z.string().min(1).optional(),
            status: z.enum(['LIVRE', 'OCUPADO', 'AGUARDANDO_PAGAMENTO']).optional(),
        })
            .parse(req.body);
        const updated = await prisma.table.update({ where: { id: params.id }, data: body });
        res.json(updated);
    }
    catch (e) {
        next(e);
    }
});
