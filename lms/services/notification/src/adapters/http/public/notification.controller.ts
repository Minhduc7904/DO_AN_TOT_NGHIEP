import { CurrentPrincipal, type Page, parseInput, Roles, toPage } from '@aiops-lms/common/http';
import type { Principal } from '@aiops-lms/common/ports';
import {
  createNotificationRequestSchema,
  idSchema,
  listMyNotificationsQuerySchema,
  type MarkAllReadDto,
  type NotificationDto,
  PUBLIC_PREFIX,
} from '@aiops-lms/contracts';
import { Body, Controller, Get, HttpCode, Inject, Param, Patch, Post, Query } from '@nestjs/common';

import { CreateNotificationUseCase } from '../../../application/use-cases/notifications/create-notification.use-case.js';
import {
  GetNotificationUseCase,
  ListMyNotificationsUseCase,
  MarkAllNotificationsReadUseCase,
  MarkNotificationReadUseCase,
} from '../../../application/use-cases/notifications/inbox.use-cases.js';
import { presentNotification } from '../shared/notification.presenter.js';

@Controller(`${PUBLIC_PREFIX}/notifications`)
export class NotificationController {
  constructor(
    @Inject(CreateNotificationUseCase)
    private readonly createNotification: CreateNotificationUseCase,
    @Inject(GetNotificationUseCase) private readonly getNotification: GetNotificationUseCase,
    @Inject(ListMyNotificationsUseCase) private readonly listMine: ListMyNotificationsUseCase,
    @Inject(MarkNotificationReadUseCase) private readonly markRead: MarkNotificationReadUseCase,
    @Inject(MarkAllNotificationsReadUseCase)
    private readonly markAllRead: MarkAllNotificationsReadUseCase,
  ) {}

  @Roles('admin')
  @Post()
  async create(
    @CurrentPrincipal() principal: Principal,
    @Body() body: unknown,
  ): Promise<NotificationDto> {
    const input = parseInput(createNotificationRequestSchema, body);
    return presentNotification(
      await this.createNotification.execute(principal.id, {
        studentId: input.student_id,
        title: input.title,
        contentMarkdown: input.content_markdown,
        sendEmail: input.send_email,
      }),
    );
  }

  // Các route cố định (`me`, `read-all`) đứng trước `:notification_id`.
  @Roles('student')
  @Get('me')
  async listMyNotifications(
    @CurrentPrincipal() principal: Principal,
    @Query() query: unknown,
  ): Promise<Page<NotificationDto>> {
    const input = parseInput(listMyNotificationsQuerySchema, query);
    const result = await this.listMine.execute(
      principal.id,
      input.status,
      input.page,
      input.page_size,
    );
    return toPage(result, input, presentNotification);
  }

  @Roles('student')
  @Post('read-all')
  @HttpCode(200)
  async readAll(@CurrentPrincipal() principal: Principal): Promise<MarkAllReadDto> {
    return { updated_count: await this.markAllRead.execute(principal.id) };
  }

  @Roles('admin')
  @Get(':notification_id')
  async get(@Param('notification_id') notificationId: string): Promise<NotificationDto> {
    return presentNotification(
      await this.getNotification.execute(parseInput(idSchema, notificationId)),
    );
  }

  @Roles('student')
  @Patch(':notification_id/read')
  async read(
    @CurrentPrincipal() principal: Principal,
    @Param('notification_id') notificationId: string,
  ): Promise<NotificationDto> {
    return presentNotification(
      await this.markRead.execute(principal.id, parseInput(idSchema, notificationId)),
    );
  }
}
