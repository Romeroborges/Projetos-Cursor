import { Router } from 'express';
import { z } from 'zod';
import { authRequired, requirePermission } from '../auth/middleware.js';
import { daySummary, salesByPeriod, topProducts } from '../services/reports.service.js';
import { stringify } from 'csv-stringify/sync';
export const reportsRouter = Router();
reportsRouter.use(authRequired);
reportsRouter.get('/summary', requirePermission('reports:read'), async (req, res, next) => {
    try {
        const query = z
            .object({
            from: z.string().datetime().optional(),
            to: z.string().datetime().optional(),
        })
            .parse(req.query);
        const out = await daySummary({
            from: query.from ? new Date(query.from) : undefined,
            to: query.to ? new Date(query.to) : undefined,
        });
        res.json(out);
    }
    catch (e) {
        next(e);
    }
});
reportsRouter.get('/sales', requirePermission('reports:read'), async (req, res, next) => {
    try {
        const query = z
            .object({
            from: z.string().datetime(),
            to: z.string().datetime(),
        })
            .parse(req.query);
        const out = await salesByPeriod({ from: new Date(query.from), to: new Date(query.to) });
        res.json(out);
    }
    catch (e) {
        next(e);
    }
});
reportsRouter.get('/sales.csv', requirePermission('reports:read'), async (req, res, next) => {
    try {
        const query = z
            .object({
            from: z.string().datetime(),
            to: z.string().datetime(),
        })
            .parse(req.query);
        const rows = await salesByPeriod({ from: new Date(query.from), to: new Date(query.to) });
        const csv = stringify(rows.map((r) => ({
            id: r.id,
            fechadoEm: r.fechadoEm?.toISOString() ?? '',
            valorTotal: r.valorTotal,
            tipoIdentificacao: r.tipoIdentificacao,
            mesa: r.table?.nomeOuNumero ?? '',
            cliente: r.nomeCliente ?? '',
        })), { header: true });
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="vendas.csv"');
        res.send(csv);
    }
    catch (e) {
        next(e);
    }
});
reportsRouter.get('/top-products', requirePermission('reports:read'), async (req, res, next) => {
    try {
        const query = z
            .object({
            from: z.string().datetime(),
            to: z.string().datetime(),
            limit: z.coerce.number().int().min(1).max(200).optional(),
        })
            .parse(req.query);
        const out = await topProducts({ from: new Date(query.from), to: new Date(query.to), limit: query.limit });
        res.json(out);
    }
    catch (e) {
        next(e);
    }
});
