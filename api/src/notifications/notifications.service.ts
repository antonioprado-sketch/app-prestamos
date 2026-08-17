import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import * as webpush from 'web-push';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface CreateNotificationInput {
  userPhone: string;
  type: string;
  title: string;
  body: string;
  metadata?: Record<string, unknown>;
}

export interface NotificationSummary {
  id: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
}

export interface SubscribePushInput {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

function toSummary(n: {
  id: bigint;
  type: string;
  title: string;
  body: string;
  readAt: Date | null;
  createdAt: Date;
}): NotificationSummary {
  return {
    id: String(n.id),
    type: n.type,
    title: n.title,
    body: n.body,
    read: n.readAt !== null,
    createdAt: n.createdAt.toISOString(),
  };
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly vapidConfigured: boolean;

  constructor(private readonly prisma: PrismaService) {
    const publicKey = process.env.VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    const subject = process.env.VAPID_SUBJECT;
    this.vapidConfigured = Boolean(publicKey && privateKey && subject);
    if (this.vapidConfigured) {
      webpush.setVapidDetails(subject!, publicKey!, privateKey!);
    }
  }

  /** Crea la notificación in-app y dispara el push en segundo plano — nunca bloquea ni hace fallar al llamador. */
  async create(input: CreateNotificationInput): Promise<NotificationSummary> {
    const notification = await this.prisma.notification.create({
      data: {
        userPhone: input.userPhone,
        type: input.type,
        title: input.title,
        body: input.body,
        metadata: input.metadata as Prisma.InputJsonValue | undefined,
      },
    });
    this.sendPush(input.userPhone, input.title, input.body, input.type).catch(
      (err) => this.logger.warn(`push falló: ${err?.message ?? err}`),
    );
    return toSummary(notification);
  }

  async findForUser(userPhone: string): Promise<NotificationSummary[]> {
    const notifications = await this.prisma.notification.findMany({
      where: { userPhone },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return notifications.map(toSummary);
  }

  async markRead(userPhone: string, id: string): Promise<NotificationSummary> {
    if (!/^\d+$/.test(id))
      throw new NotFoundException('Notificación no encontrada');
    const notification = await this.prisma.notification.findUnique({
      where: { id: BigInt(id) },
    });
    if (!notification || notification.userPhone !== userPhone) {
      throw new NotFoundException('Notificación no encontrada');
    }
    const updated = notification.readAt
      ? notification
      : await this.prisma.notification.update({
          where: { id: notification.id },
          data: { readAt: new Date() },
        });
    return toSummary(updated);
  }

  async subscribe(userPhone: string, input: SubscribePushInput): Promise<void> {
    await this.prisma.pushSubscription.upsert({
      where: { endpoint: input.endpoint },
      create: {
        userPhone,
        endpoint: input.endpoint,
        p256dh: input.keys.p256dh,
        auth: input.keys.auth,
      },
      update: {
        userPhone,
        p256dh: input.keys.p256dh,
        auth: input.keys.auth,
      },
    });
  }

  private async sendPush(
    userPhone: string,
    title: string,
    body: string,
    type: string,
  ): Promise<void> {
    if (!this.vapidConfigured) {
      this.logger.log(`[push-simulado] to=${userPhone} title=${title}`);
      return;
    }
    const subscriptions = await this.prisma.pushSubscription.findMany({
      where: { userPhone },
    });
    const payload = JSON.stringify({ title, body, type });
    await Promise.all(
      subscriptions.map(async (sub) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            payload,
          );
        } catch (err) {
          const statusCode = (err as { statusCode?: number }).statusCode;
          if (statusCode === 404 || statusCode === 410) {
            await this.prisma.pushSubscription
              .delete({ where: { id: sub.id } })
              .catch(() => undefined);
          }
        }
      }),
    );
  }
}
