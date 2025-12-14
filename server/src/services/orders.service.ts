import { prisma } from '../db.js';
import { HttpError } from '../types.js';
import { getOpenCashRegister } from './cash.service.js';
import { auditLog } from './audit.service.js';

function assertIdentification(params: {
  tipo: 'MESA' | 'CLIENTE';
  tableId?: string | null;
  nomeCliente?: string | null;
}) {
  if (params.tipo === 'MESA') {
    if (!params.tableId) throw new HttpError(422, 'ORDER_IDENTIFICATION_REQUIRED');
    return;
  }
  if (!params.nomeCliente?.trim()) throw new HttpError(422, 'ORDER_IDENTIFICATION_REQUIRED');
}

export async function openOrder(params: {
  userId: string;
  tipoIdentificacao: 'MESA' | 'CLIENTE';
  tableId?: string | null;
  nomeCliente?: string | null;
}) {
  const cash = await getOpenCashRegister();
  if (!cash) throw new HttpError(409, 'CASH_REGISTER_MUST_BE_OPEN');

  assertIdentification({ tipo: params.tipoIdentificacao, tableId: params.tableId, nomeCliente: params.nomeCliente });

  if (params.tipoIdentificacao === 'MESA' && params.tableId) {
    const table = await prisma.table.findUnique({ where: { id: params.tableId } });
    if (!table) throw new HttpError(404, 'TABLE_NOT_FOUND');
    if (table.status !== 'LIVRE') throw new HttpError(409, 'TABLE_NOT_AVAILABLE');
  }

  const order = await prisma.$transaction(async (tx) => {
    const created = await tx.order.create({
      data: {
        tipoIdentificacao: params.tipoIdentificacao,
        tableId: params.tipoIdentificacao === 'MESA' ? params.tableId ?? null : null,
        nomeCliente: params.tipoIdentificacao === 'CLIENTE' ? params.nomeCliente?.trim() ?? null : null,
        status: 'ABERTO',
        abertoPorId: params.userId,
        valorTotal: 0,
      },
      include: { table: true },
    });

    if (created.tableId) {
      await tx.table.update({ where: { id: created.tableId }, data: { status: 'OCUPADO' } });
    }

    return created;
  });

  return order;
}

export async function convertOrderIdentification(params: {
  userId: string;
  orderId: string;
  to: 'MESA' | 'CLIENTE';
  tableId?: string | null;
  nomeCliente?: string | null;
}) {
  const order = await prisma.order.findUnique({ where: { id: params.orderId } });
  if (!order) throw new HttpError(404, 'ORDER_NOT_FOUND');
  if (order.status === 'FECHADO') throw new HttpError(409, 'ORDER_ALREADY_CLOSED');

  assertIdentification({ tipo: params.to, tableId: params.tableId, nomeCliente: params.nomeCliente });

  return prisma.$transaction(async (tx) => {
    // liberar mesa anterior se existia
    if (order.tableId) {
      await tx.table.update({ where: { id: order.tableId }, data: { status: 'LIVRE' } });
    }

    if (params.to === 'MESA') {
      if (!params.tableId) throw new HttpError(422, 'ORDER_IDENTIFICATION_REQUIRED');
      const table = await tx.table.findUnique({ where: { id: params.tableId } });
      if (!table) throw new HttpError(404, 'TABLE_NOT_FOUND');
      if (table.status !== 'LIVRE') throw new HttpError(409, 'TABLE_NOT_AVAILABLE');

      const updated = await tx.order.update({
        where: { id: params.orderId },
        data: {
          tipoIdentificacao: 'MESA',
          tableId: params.tableId,
          nomeCliente: null,
        },
        include: { table: true, itens: { include: { product: true } }, pagamentos: true },
      });

      await tx.table.update({ where: { id: params.tableId }, data: { status: 'OCUPADO' } });
      return updated;
    }

    const updated = await tx.order.update({
      where: { id: params.orderId },
      data: {
        tipoIdentificacao: 'CLIENTE',
        tableId: null,
        nomeCliente: params.nomeCliente?.trim() ?? null,
      },
      include: { table: true, itens: { include: { product: true } }, pagamentos: true },
    });

    return updated;
  });
}

export async function addOrderItem(params: {
  userId: string;
  orderId: string;
  productId: string;
  quantidade: number;
  observacao?: string | null;
}) {
  const order = await prisma.order.findUnique({ where: { id: params.orderId } });
  if (!order) throw new HttpError(404, 'ORDER_NOT_FOUND');
  if (order.status === 'FECHADO') throw new HttpError(409, 'ORDER_ALREADY_CLOSED');

  const product = await prisma.product.findUnique({ where: { id: params.productId } });
  if (!product || !product.ativo) throw new HttpError(404, 'PRODUCT_NOT_FOUND');
  if (params.quantidade <= 0) throw new HttpError(422, 'INVALID_QUANTITY');

  const precoUnitario = product.preco;
  const precoTotal = precoUnitario * params.quantidade;

  return prisma.$transaction(async (tx) => {
    const item = await tx.orderItem.create({
      data: {
        orderId: params.orderId,
        productId: params.productId,
        quantidade: params.quantidade,
        observacao: params.observacao ?? null,
        precoUnitario,
        precoTotal,
      },
      include: { product: true },
    });

    if (product.controlaEstoque) {
      const stock = await tx.stock.findUnique({ where: { productId: product.id } });
      if (!stock) throw new HttpError(409, 'STOCK_NOT_CONFIGURED');
      if (stock.quantidadeAtual < params.quantidade) throw new HttpError(409, 'INSUFFICIENT_STOCK');

      await tx.stock.update({
        where: { productId: product.id },
        data: { quantidadeAtual: { decrement: params.quantidade } },
      });
    }

    await tx.order.update({
      where: { id: params.orderId },
      data: {
        status: 'EM_ANDAMENTO',
        valorTotal: { increment: precoTotal },
      },
    });

    return item;
  });
}

export async function cancelOrderItem(params: { userId: string; itemId: string; motivo?: string }) {
  const item = await prisma.orderItem.findUnique({ where: { id: params.itemId }, include: { product: true, order: true } });
  if (!item) throw new HttpError(404, 'ITEM_NOT_FOUND');
  if (item.canceladoEm) throw new HttpError(409, 'ITEM_ALREADY_CANCELED');
  if (item.order.status === 'FECHADO') throw new HttpError(409, 'ORDER_ALREADY_CLOSED');

  return prisma.$transaction(async (tx) => {
    const updated = await tx.orderItem.update({ where: { id: item.id }, data: { canceladoEm: new Date() } });

    // devolver estoque se aplicável
    if (item.product.controlaEstoque) {
      await tx.stock.update({ where: { productId: item.productId }, data: { quantidadeAtual: { increment: item.quantidade } } });
    }

    // ajustar total
    await tx.order.update({ where: { id: item.orderId }, data: { valorTotal: { decrement: item.precoTotal } } });

    const cash = await tx.cashRegister.findFirst({ where: { status: 'ABERTO' } });
    await auditLog({
      userId: params.userId,
      cashRegisterId: cash?.id,
      action: 'CANCELAMENTO_ITEM',
      details: { itemId: item.id, orderId: item.orderId, motivo: params.motivo },
      db: tx,
    });

    return updated;
  });
}

export async function addPayment(params: { userId: string; orderId: string; metodo: 'CREDITO' | 'DEBITO' | 'PIX' | 'DINHEIRO'; valor: number }) {
  const order = await prisma.order.findUnique({ where: { id: params.orderId }, include: { pagamentos: true } });
  if (!order) throw new HttpError(404, 'ORDER_NOT_FOUND');
  if (order.status === 'FECHADO') throw new HttpError(409, 'ORDER_ALREADY_CLOSED');
  if (params.valor <= 0) throw new HttpError(422, 'INVALID_AMOUNT');

  return prisma.payment.create({
    data: { orderId: params.orderId, metodo: params.metodo, valor: params.valor },
  });
}

export async function closeOrder(params: { userId: string; orderId: string }) {
  const cash = await getOpenCashRegister();
  if (!cash) throw new HttpError(409, 'CASH_REGISTER_MUST_BE_OPEN');

  const order = await prisma.order.findUnique({
    where: { id: params.orderId },
    include: { pagamentos: true, itens: true },
  });
  if (!order) throw new HttpError(404, 'ORDER_NOT_FOUND');
  if (order.status === 'FECHADO') throw new HttpError(409, 'ORDER_ALREADY_CLOSED');
  if (order.itens.filter((i) => !i.canceladoEm).length === 0) throw new HttpError(409, 'ORDER_HAS_NO_ITEMS');

  const paid = order.pagamentos.reduce((sum, p) => sum + p.valor, 0);
  if (paid < order.valorTotal) throw new HttpError(409, 'INSUFFICIENT_PAYMENT');

  return prisma.$transaction(async (tx) => {
    const updated = await tx.order.update({
      where: { id: params.orderId },
      data: { status: 'FECHADO', fechadoEm: new Date() },
      include: { table: true, itens: { include: { product: true } }, pagamentos: true },
    });

    if (updated.tableId) {
      await tx.table.update({ where: { id: updated.tableId }, data: { status: 'LIVRE' } });
    }

    // Não armazenamos valorFinal automaticamente aqui porque normalmente depende de conferência física.
    // Mas registramos no log do caixa que esta comanda foi fechada.
    await auditLog({
      userId: params.userId,
      cashRegisterId: cash.id,
      action: 'FECHAMENTO_COMANDA',
      details: { orderId: updated.id, valorTotal: updated.valorTotal, pago: paid },
      db: tx,
    });

    return updated;
  });
}

export async function getOrderById(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      table: true,
      itens: { include: { product: true }, orderBy: { criadoEm: 'asc' } },
      pagamentos: { orderBy: { pagoEm: 'asc' } },
    },
  });
  if (!order) throw new HttpError(404, 'ORDER_NOT_FOUND');
  return order;
}
