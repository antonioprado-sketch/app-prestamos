import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { SubscribePushDto } from './dto/subscribe-push.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('api/v1/notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  async findAll(@CurrentUser() user: { phone: string }) {
    return this.notifications.findForUser(user.phone);
  }

  @Patch(':id/read')
  async markRead(
    @Param('id') id: string,
    @CurrentUser() user: { phone: string },
  ) {
    return this.notifications.markRead(user.phone, id);
  }

  @Post('webpush-subscribe')
  @HttpCode(HttpStatus.CREATED)
  async subscribe(
    @Body() dto: SubscribePushDto,
    @CurrentUser() user: { phone: string },
  ) {
    await this.notifications.subscribe(user.phone, dto);
    return { subscribed: true };
  }
}
