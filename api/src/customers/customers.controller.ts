import { Body, Controller, Patch, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { CustomersService } from './customers.service';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('api/v1/customers')
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Patch('me')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CLIENT')
  async updateMe(
    @Body() dto: UpdateCustomerDto,
    @CurrentUser() user: { phone: string },
    @Req() req: Request,
  ) {
    return this.customers.updateMe(
      user.phone,
      dto,
      req.ip ?? '',
      req.headers['user-agent'] ?? '',
    );
  }
}
