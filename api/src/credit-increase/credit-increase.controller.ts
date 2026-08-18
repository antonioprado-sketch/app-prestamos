import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { CreditIncreaseService } from './credit-increase.service';
import { CreateCreditIncreaseDto } from './dto/create-credit-increase.dto';
import { ResolveCreditIncreaseDto } from './dto/resolve-credit-increase.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('api/v1/credit-increase')
export class CreditIncreaseController {
  constructor(private readonly creditIncrease: CreditIncreaseService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CLIENT')
  async create(
    @Body() dto: CreateCreditIncreaseDto,
    @CurrentUser() user: { phone: string },
    @Req() req: Request,
  ) {
    return this.creditIncrease.create(
      user.phone,
      dto,
      req.ip ?? '',
      req.headers['user-agent'] ?? '',
    );
  }

  @Get('me')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CLIENT')
  async getMyLatest(@CurrentUser() user: { phone: string }) {
    return { request: await this.creditIncrease.getMyLatest(user.phone) };
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'COLLECTOR')
  async findPending() {
    return this.creditIncrease.findPending();
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'COLLECTOR')
  async resolve(
    @Param('id') id: string,
    @Body() dto: ResolveCreditIncreaseDto,
    @CurrentUser() user: { phone: string },
    @Req() req: Request,
  ) {
    return this.creditIncrease.resolve(
      user.phone,
      id,
      dto,
      req.ip ?? '',
      req.headers['user-agent'] ?? '',
    );
  }
}
