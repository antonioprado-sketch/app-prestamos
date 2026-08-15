import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { AdminCustomersService } from './admin-customers.service';
import { UpdateNewClientDto } from './dto/update-new-client.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('api/v1/admin/customers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminCustomersController {
  constructor(private readonly adminCustomers: AdminCustomersService) {}

  @Get()
  async findAll() {
    return this.adminCustomers.findAll();
  }

  @Get(':phone')
  async findOne(@Param('phone') phone: string) {
    return this.adminCustomers.findOne(phone);
  }

  @Patch(':phone/new-client')
  async updateNewClient(
    @Param('phone') phone: string,
    @Body() dto: UpdateNewClientDto,
    @CurrentUser() user: { phone: string },
    @Req() req: Request,
  ) {
    return this.adminCustomers.updateNewClient(
      user.phone,
      phone,
      dto.isNewCustomer,
      req.ip ?? '',
      req.headers['user-agent'] ?? '',
    );
  }
}
