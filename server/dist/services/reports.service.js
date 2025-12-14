import { prisma } from '../db.js';
export async function daySummary(params) {
    const from = params.from ?? new Date(new Date().setHours(0, 0, 0, 0));
    const to = params.to ?? new Date();
    const [totalVendido, comandosAbertos] = await Promise.all([
        prisma.order.aggregate({
            where: { status: 'FECHADO', fechadoEm: { gte: from, lte: to } },
            _sum: { valorTotal: true },
        }),
        prisma.order.count({ where: { status: { in: ['ABERTO', 'EM_ANDAMENTO'] } } }),
    ]);
    return {
        from,
        to,
        totalVendido: totalVendido._sum.valorTotal ?? 0,
        comandosAbertos,
    };
}
export async function salesByPeriod(params) {
    const orders = await prisma.order.findMany({
        where: { status: 'FECHADO', fechadoEm: { gte: params.from, lte: params.to } },
        select: {
            id: true,
            fechadoEm: true,
            valorTotal: true,
            tipoIdentificacao: true,
            nomeCliente: true,
            table: { select: { nomeOuNumero: true } },
        },
        orderBy: { fechadoEm: 'asc' },
    });
    return orders;
}
export async function topProducts(params) {
    const limit = params.limit ?? 20;
    // Itens do período: filtra por ordem fechada no período
    const items = await prisma.orderItem.findMany({
        where: {
            canceladoEm: null,
            order: { status: 'FECHADO', fechadoEm: { gte: params.from, lte: params.to } },
        },
        select: {
            quantidade: true,
            precoTotal: true,
            product: { select: { id: true, nome: true, categoria: true } },
        },
    });
    const map = new Map();
    for (const it of items) {
        const key = it.product.id;
        const prev = map.get(key);
        if (!prev) {
            map.set(key, {
                productId: it.product.id,
                nome: it.product.nome,
                categoria: it.product.categoria,
                quantidade: it.quantidade,
                total: it.precoTotal,
            });
        }
        else {
            prev.quantidade += it.quantidade;
            prev.total += it.precoTotal;
        }
    }
    return Array.from(map.values())
        .sort((a, b) => b.quantidade - a.quantidade)
        .slice(0, limit);
}
