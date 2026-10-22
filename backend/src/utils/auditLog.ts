import prisma from '../lib/prisma';

export async function createAuditLog(params: {
  userId: string;
  action: string;
  resource: string;
  resourceId?: string;
  details?: object;
  ipAddress?: string;
  userAgent?: string;
}) {
  await prisma.auditLog.create({
    data: {
      userId: params.userId,
      action: params.action,
      resource: params.resource,
      resourceId: params.resourceId,
      details: params.details ? (params.details as object) : undefined,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    },
  });
}
