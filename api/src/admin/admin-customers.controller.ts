import {
  Body,
  Controller,
  Delete,
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
import { AdminCustomersService } from './admin-customers.service';
import { UpdateNewClientDto } from './dto/update-new-client.dto';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { DocumentsService } from '../documents/documents.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('api/v1/admin/customers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminCustomersController {
  constructor(
    private readonly adminCustomers: AdminCustomersService,
    private readonly documents: DocumentsService,
  ) {}

  @Get()
  async findAll() {
    return this.adminCustomers.findAll();
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreateCustomerDto,
    @CurrentUser() user: { phone: string },
    @Req() req: Request,
  ) {
    return this.adminCustomers.create(
      user.phone,
      dto.phone,
      req.ip ?? '',
      req.headers['user-agent'] ?? '',
    );
  }

  @Get(':phone')
  async findOne(@Param('phone') phone: string) {
    return this.adminCustomers.findOne(phone);
  }

  @Get(':phone/documents')
  async findDocuments(@Param('phone') phone: string) {
    return this.documents.findMine(phone);
  }

  @Delete(':phone')
  @HttpCode(HttpStatus.OK)
  async remove(
    @Param('phone') phone: string,
    @CurrentUser() user: { phone: string },
    @Req() req: Request,
  ) {
    await this.adminCustomers.remove(
      user.phone,
      phone,
      req.ip ?? '',
      req.headers['user-agent'] ?? '',
    );
    return { removed: true };
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
