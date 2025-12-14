import { prisma } from '../db.js';
import { HttpError } from '../types.js';
import { auditLog } from './audit.service.js';

export async function getOpenCashRegister() {
  return prisma.cashRegister.findFirst({ where: { status: 'ABERTO' }, orderBy: { abertoEm: 'desc' } });
}

export async function openCashRegister(params: { userId: string; valorInicial: number }) {
  const open = await getOpenCashRegister();
  if (open) throw new HttpError(409, 'CASH_REGISTER_ALREADY_OPEN');

  const cash = await prisma.cashRegister.create({
    data: {
      abertoPorId: params.userId,
      valorInicial: params.valorInicial,
      status: 'ABERTO',
    },
  });

  await auditLog({
    userId: params.userId,
    cashRegisterId: cash.id,
    action: 'ABERTURA_CAIXA',
    details: { valorInicial: params.valorInicial },
  });

  return cash;
}

export async function closeCashRegister(params: { userId: string; valorFinal: number }) {
  const open = await getOpenCashRegister();
  if (!open) throw new HttpError(409, 'NO_OPEN_CASH_REGISTER');

  const fechadoEm = new Date();

  const [paymentsAgg, movements] = await Promise.all([
    prisma.payment.aggregate({
      where: { pagoEm: { gte: open.abertoEm, lte: fechadoEm } },
      _sum: { valor: true },
    }),
    prisma.cashMovement.findMany({ where: { cashRegisterId: open.id }, select: { tipo: true, valor: true } }),
  ]);

  const totalPayments = paymentsAgg._sum.valor ?? 0;
  const totalMovements = movements.reduce((sum, m) => sum + (m.tipo === 'REFORCO' ? m.valor : -m.valor), 0);
  const expected = open.valorInicial + totalPayments + totalMovements;
  const diff = params.valorFinal - expected;

  const closed = await prisma.cashRegister.update({
    where: { id: open.id },
    data: {
      status: 'FECHADO',
      fechadoEm,
      valorFinal: params.valorFinal,
    },
  });

  await auditLog({
    userId: params.userId,
    cashRegisterId: closed.id,
    action: 'FECHAMENTO_CAIXA',
    details: { valorFinal: params.valorFinal, expected, diff, totalPayments, totalMovements },
  });

  return closed;
}

export async function cashAdjustment(params: {
  userId: string;
  type: 'SANGRIA' | 'REFORCO';
  valor: number;
  motivo?: string;
}) {
  const open = await getOpenCashRegister();
  if (!open) throw new HttpError(409, 'NO_OPEN_CASH_REGISTER');

  await prisma.cashMovement.create({
    data: {
      cashRegisterId: open.id,
      userId: params.userId,
      tipo: params.type,
      valor: params.valor,
      motivo: params.motivo,
    },
  });

  await auditLog({
    userId: params.userId,
    cashRegisterId: open.id,
    action: params.type === 'SANGRIA' ? 'SANGRIA' : 'REFORCO',
    details: { valor: params.valor, motivo: params.motivo },
  });

  return { ok: true };
}
