import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { BlacklistService } from '../blacklist/blacklist.service';
import { AuditService } from '../audit/audit.service';
import { AddToBlacklistDto } from './dto/add-to-blacklist.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('api/v1/admin/blacklist')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminBlacklistController {
  constructor(
    private readonly blacklist: BlacklistService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  async findAll() {
    return this.blacklist.findAll();
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async add(
    @Body() dto: AddToBlacklistDto,
    @CurrentUser() user: { phone: string },
    @Req() req: Request,
  ) {
    const entry = await this.blacklist.add(dto.phone, dto.reason, user.phone);
    await this.audit.log({
      userPhone: user.phone,
      action: 'blacklist_added',
      entity: 'blacklist',
      entityId: dto.phone,
      newValue: { reason: dto.reason },
      ip: req.ip ?? '',
      userAgent: req.headers['user-agent'] ?? '',
    });
    return entry;
  }

  @Delete(':phone')
  @HttpCode(HttpStatus.OK)
  async remove(
    @Param('phone') phone: string,
    @CurrentUser() user: { phone: string },
    @Req() req: Request,
  ) {
    await this.blacklist.remove(phone);
    await this.audit.log({
      userPhone: user.phone,
      action: 'blacklist_removed',
      entity: 'blacklist',
      entityId: phone,
      ip: req.ip ?? '',
      userAgent: req.headers['user-agent'] ?? '',
    });
    return { removed: true };
  }
}
