import { Router } from 'express';
import { z } from 'zod';
import { authRequired, requirePermission } from '../auth/middleware.js';
import { addOrderItem, addPayment, cancelOrderItem, closeOrder, convertOrderIdentification, getOrderById, openOrder, } from '../services/orders.service.js';
import { prisma } from '../db.js';
export const ordersRouter = Router();
ordersRouter.use(authRequired);
ordersRouter.get('/', requirePermission('orders:read'), async (req, res, next) => {
    try {
        const query = z
            .object({
            status: z.enum(['ABERTO', 'EM_ANDAMENTO', 'FECHADO']).optional(),
            tableId: z.string().optional(),
            cliente: z.string().optional(),
        })
            .parse(req.query);
        const orders = await prisma.order.findMany({
            where: {
                status: query.status,
                tableId: query.tableId,
                nomeCliente: query.cliente ? { contains: query.cliente } : undefined,
            },
            include: { table: true },
            orderBy: { abertoEm: 'desc' },
        });
        res.json(orders);
    }
    catch (e) {
        next(e);
    }
});
ordersRouter.post('/', requirePermission('orders:write'), async (req, res, next) => {
    try {
        const body = z
            .object({
            tipoIdentificacao: z.enum(['MESA', 'CLIENTE']),
            tableId: z.string().nullable().optional(),
            nomeCliente: z.string().nullable().optional(),
        })
            .parse(req.body);
        const order = await openOrder({
            userId: req.user.id,
            tipoIdentificacao: body.tipoIdentificacao,
            tableId: body.tableId,
            nomeCliente: body.nomeCliente,
        });
        res.status(201).json(order);
    }
    catch (e) {
        next(e);
    }
});
ordersRouter.get('/:id', requirePermission('orders:read'), async (req, res, next) => {
    try {
        const params = z.object({ id: z.string().min(1) }).parse(req.params);
        const order = await getOrderById(params.id);
        res.json(order);
    }
    catch (e) {
        next(e);
    }
});
ordersRouter.post('/:id/convert', requirePermission('orders:write'), async (req, res, next) => {
    try {
        const params = z.object({ id: z.string().min(1) }).parse(req.params);
        const body = z
            .object({
            to: z.enum(['MESA', 'CLIENTE']),
            tableId: z.string().nullable().optional(),
            nomeCliente: z.string().nullable().optional(),
        })
            .parse(req.body);
        const updated = await convertOrderIdentification({
            userId: req.user.id,
            orderId: params.id,
            to: body.to,
            tableId: body.tableId,
            nomeCliente: body.nomeCliente,
        });
        res.json(updated);
    }
    catch (e) {
        next(e);
    }
});
ordersRouter.post('/:id/items', requirePermission('orders:write'), async (req, res, next) => {
    try {
        const params = z.object({ id: z.string().min(1) }).parse(req.params);
        const body = z
            .object({
            productId: z.string().min(1),
            quantidade: z.number().int().min(1),
            observacao: z.string().optional(),
        })
            .parse(req.body);
        const item = await addOrderItem({
            userId: req.user.id,
            orderId: params.id,
            productId: body.productId,
            quantidade: body.quantidade,
            observacao: body.observacao ?? null,
        });
        res.status(201).json(item);
    }
    catch (e) {
        next(e);
    }
});
ordersRouter.post('/items/:itemId/cancel', requirePermission('orders:write'), async (req, res, next) => {
    try {
        const params = z.object({ itemId: z.string().min(1) }).parse(req.params);
        const body = z.object({ motivo: z.string().optional() }).parse(req.body ?? {});
        const item = await cancelOrderItem({ userId: req.user.id, itemId: params.itemId, motivo: body.motivo });
        res.json(item);
    }
    catch (e) {
        next(e);
    }
});
ordersRouter.post('/:id/payments', requirePermission('orders:close'), async (req, res, next) => {
    try {
        const params = z.object({ id: z.string().min(1) }).parse(req.params);
        const body = z
            .object({
            metodo: z.enum(['CREDITO', 'DEBITO', 'PIX', 'DINHEIRO']),
            valor: z.number().int().min(1),
        })
            .parse(req.body);
        const payment = await addPayment({
            userId: req.user.id,
            orderId: params.id,
            metodo: body.metodo,
            valor: body.valor,
        });
        res.status(201).json(payment);
    }
    catch (e) {
        next(e);
    }
});
ordersRouter.post('/:id/close', requirePermission('orders:close'), async (req, res, next) => {
    try {
        const params = z.object({ id: z.string().min(1) }).parse(req.params);
        const closed = await closeOrder({ userId: req.user.id, orderId: params.id });
        res.json(closed);
    }
    catch (e) {
        next(e);
    }
});
