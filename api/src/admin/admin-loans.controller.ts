import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { AdminLoansService } from './admin-loans.service';
import { RejectLoanDto } from './dto/reject-loan.dto';
import { RequestCorrectionDto } from './dto/request-correction.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('api/v1/admin/loans')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminLoansController {
  constructor(private readonly adminLoans: AdminLoansService) {}

  @Get()
  async findAll(@Query('status') status?: string) {
    return this.adminLoans.findAll(status);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.adminLoans.findOne(id);
  }

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  async approve(
    @Param('id') id: string,
    @CurrentUser() user: { phone: string },
    @Req() req: Request,
  ) {
    return this.adminLoans.approve(
      user.phone,
      id,
      req.ip ?? '',
      req.headers['user-agent'] ?? '',
    );
  }

  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  async reject(
    @Param('id') id: string,
    @Body() dto: RejectLoanDto,
    @CurrentUser() user: { phone: string },
    @Req() req: Request,
  ) {
    return this.adminLoans.reject(
      user.phone,
      id,
      dto.reason,
      req.ip ?? '',
      req.headers['user-agent'] ?? '',
    );
  }

  @Post(':id/request-correction')
  @HttpCode(HttpStatus.OK)
  async requestCorrection(
    @Param('id') id: string,
    @Body() dto: RequestCorrectionDto,
    @CurrentUser() user: { phone: string },
    @Req() req: Request,
  ) {
    return this.adminLoans.requestCorrection(
      user.phone,
      id,
      dto.reason,
      req.ip ?? '',
      req.headers['user-agent'] ?? '',
    );
  }
}
