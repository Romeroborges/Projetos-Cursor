import { prisma } from '../db.js';
export async function auditLog(params) {
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
