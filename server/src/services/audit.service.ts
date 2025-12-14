import { prisma } from '../db.js';
import type { AuditAction, Prisma, PrismaClient } from '@prisma/client';

type DbClient = PrismaClient | Prisma.TransactionClient;

export async function auditLog(params: {
  userId?: string;
  cashRegisterId?: string;
  action: AuditAction;
  details?: unknown;
  db?: DbClient;
}) {
  const db = params.db ?? prisma;
  await db.auditLog.create({
    data: {
      userId: params.userId,
      cashRegisterId: params.cashRegisterId,
      action: params.action,
      detailsJson: params.details ? JSON.stringify(params.details) : undefined,
    },
  });
}
