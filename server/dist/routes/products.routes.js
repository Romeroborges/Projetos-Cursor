import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { authRequired, requirePermission } from '../auth/middleware.js';
import { HttpError } from '../types.js';
import { auditLog } from '../services/audit.service.js';
export const productsRouter = Router();
productsRouter.use(authRequired);
productsRouter.get('/', requirePermission('products:read'), async (_req, res) => {
    const products = await prisma.product.findMany({ include: { estoque: true }, orderBy: { categoria: 'asc' } });
    res.json(products);
});
productsRouter.post('/', requirePermission('products:write'), async (req, res, next) => {
    try {
        const body = z
            .object({
            nome: z.string().min(1),
            categoria: z.string().min(1),
            preco: z.number().int().min(0),
            controleDeEstoque: z.boolean().optional(),
            quantidadeAtual: z.number().int().min(0).optional(),
            quantidadeMinima: z.number().int().min(0).optional(),
        })
            .parse(req.body);
        const created = await prisma.$transaction(async (tx) => {
            const p = await tx.product.create({
                data: {
                    nome: body.nome,
                    categoria: body.categoria,
                    preco: body.preco,
                    controlaEstoque: body.controleDeEstoque ?? false,
                },
            });
            if (p.controlaEstoque) {
                await tx.stock.create({
                    data: {
                        productId: p.id,
                        quantidadeAtual: body.quantidadeAtual ?? 0,
                        quantidadeMinima: body.quantidadeMinima ?? 0,
                    },
                });
            }
            return tx.product.findUnique({ where: { id: p.id }, include: { estoque: true } });
        });
        res.status(201).json(created);
    }
    catch (e) {
        next(e);
    }
});
productsRouter.patch('/:id/stock', requirePermission('products:write'), async (req, res, next) => {
    try {
        const params = z.object({ id: z.string().min(1) }).parse(req.params);
        const body = z
            .object({
            quantidadeAtual: z.number().int().min(0).optional(),
            quantidadeMinima: z.number().int().min(0).optional(),
            motivo: z.string().min(1).optional(),
        })
            .parse(req.body);
        const product = await prisma.product.findUnique({ where: { id: params.id }, include: { estoque: true } });
        if (!product)
            throw new HttpError(404, 'PRODUCT_NOT_FOUND');
        if (!product.controlaEstoque)
            throw new HttpError(409, 'PRODUCT_DOES_NOT_CONTROL_STOCK');
        const updated = await prisma.stock.update({
            where: { productId: params.id },
            data: {
                quantidadeAtual: body.quantidadeAtual,
                quantidadeMinima: body.quantidadeMinima,
            },
        });
        await auditLog({
            userId: req.user.id,
            action: 'AJUSTE_ESTOQUE',
            details: { productId: params.id, ...body },
        });
        res.json(updated);
    }
    catch (e) {
        next(e);
    }
});
