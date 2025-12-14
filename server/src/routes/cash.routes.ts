import { Router } from 'express';
import { z } from 'zod';
import { authRequired, requirePermission } from '../auth/middleware.js';
import { cashAdjustment, closeCashRegister, getOpenCashRegister, openCashRegister } from '../services/cash.service.js';

export const cashRouter = Router();

cashRouter.use(authRequired);

cashRouter.get('/open', requirePermission('cash:read'), async (_req, res) => {
  const open = await getOpenCashRegister();
  res.json(open);
});

cashRouter.post('/open', requirePermission('cash:write'), async (req, res, next) => {
  try {
    const body = z.object({ valorInicial: z.number().int().min(0) }).parse(req.body);
    const cash = await openCashRegister({ userId: req.user!.id, valorInicial: body.valorInicial });
    res.status(201).json(cash);
  } catch (e) {
    next(e);
  }
});

cashRouter.post('/close', requirePermission('cash:write'), async (req, res, next) => {
  try {
    const body = z.object({ valorFinal: z.number().int().min(0) }).parse(req.body);
    const cash = await closeCashRegister({ userId: req.user!.id, valorFinal: body.valorFinal });
    res.json(cash);
  } catch (e) {
    next(e);
  }
});

cashRouter.post('/adjust', requirePermission('cash:write'), async (req, res, next) => {
  try {
    const body = z
      .object({
        type: z.enum(['SANGRIA', 'REFORCO']),
        valor: z.number().int().min(1),
        motivo: z.string().optional(),
      })
      .parse(req.body);

    const out = await cashAdjustment({ userId: req.user!.id, type: body.type, valor: body.valor, motivo: body.motivo });
    res.json(out);
  } catch (e) {
    next(e);
  }
});
