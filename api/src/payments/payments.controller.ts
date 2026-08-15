import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { PaymentsService } from './payments.service';
import { RegisterPaymentDto } from './dto/register-payment.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('api/v1/loans/:id/payments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles('ADMIN', 'COLLECTOR')
  async register(
    @Param('id') id: string,
    @Body() dto: RegisterPaymentDto,
    @CurrentUser() user: { phone: string },
    @Req() req: Request,
  ) {
    return this.payments.register(
      user.phone,
      id,
      dto,
      req.ip ?? '',
      req.headers['user-agent'] ?? '',
    );
  }

  @Get()
  @Roles('ADMIN', 'COLLECTOR', 'CLIENT')
  async findForLoan(
    @Param('id') id: string,
    @CurrentUser() user: { phone: string },
  ) {
    return this.payments.findForLoan(user.phone, id);
  }
}
