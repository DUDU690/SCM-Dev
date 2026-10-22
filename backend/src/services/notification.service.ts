import prisma from '../lib/prisma';

export async function createNotification(params: {
  userId: string;
  title: string;
  message: string;
  type: string;
  senderId?: string;
  link?: string;
}) {
  return prisma.notification.create({ data: params });
}

export async function createBulkNotifications(
  userIds: string[],
  data: { title: string; message: string; type: string; senderId?: string; link?: string },
) {
  return prisma.notification.createMany({
    data: userIds.map((userId) => ({ ...data, userId })),
  });
}

export async function markAsRead(notificationId: string, userId: string) {
  return prisma.notification.updateMany({
    where: { id: notificationId, userId },
    data: { isRead: true },
  });
}

export async function markAllAsRead(userId: string) {
  return prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true },
  });
}

export async function getNotifications(userId: string, page = 1, limit = 20) {
  const skip = (page - 1) * limit;
  const [total, notifications] = await Promise.all([
    prisma.notification.count({ where: { userId } }),
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
  ]);
  return { notifications, total, unreadCount: await prisma.notification.count({ where: { userId, isRead: false } }) };
}
