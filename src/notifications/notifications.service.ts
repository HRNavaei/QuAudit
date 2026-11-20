import { Injectable, NotFoundException, ForbiddenException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async createNotification(data: {
    senderId: string;
    receiverId: string;
    title: string;
    message: string;
    type?: string;
  }) {
    return this.prisma.notification.create({
      data: {
        senderId: data.senderId,
        receiverId: data.receiverId,
        title: data.title,
        message: data.message,
        type: data.type || "INFO",
      },
    });
  }

  async getMyNotifications(userId: string, unreadOnly?: boolean) {
    return this.prisma.notification.findMany({
      where: {
        receiverId: userId,
        ...(unreadOnly ? { isRead: false } : {}),
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async markAsRead(id: string, userId: string) {
    const notification = await this.prisma.notification.findUnique({
      where: { id },
    });
    if (!notification) {
      throw new NotFoundException(`Notification with ID ${id} not found`);
    }
    if (notification.receiverId !== userId) {
      throw new ForbiddenException("Cannot modify notifications for another user");
    }

    return this.prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });
  }

  async markAllAsRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: {
        receiverId: userId,
        isRead: false,
      },
      data: { isRead: true },
    });
  }
}
