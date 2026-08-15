import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { AdminCollectorsService } from './admin-collectors.service';
import { CreateCollectorDto } from './dto/create-collector.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('api/v1/admin/collectors')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminCollectorsController {
  constructor(private readonly adminCollectors: AdminCollectorsService) {}

  @Get()
  async findAll() {
    return this.adminCollectors.findAll();
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreateCollectorDto,
    @CurrentUser() user: { phone: string },
    @Req() req: Request,
  ) {
    return this.adminCollectors.create(
      user.phone,
      dto,
      req.ip ?? '',
      req.headers['user-agent'] ?? '',
    );
  }
}
