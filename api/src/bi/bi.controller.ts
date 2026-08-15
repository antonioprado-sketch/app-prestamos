import { Controller, Get, UseGuards } from '@nestjs/common';
import { BiService } from './bi.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('api/v1/admin/bi')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class BiController {
  constructor(private readonly bi: BiService) {}

  @Get('kpis')
  async getKpis() {
    return this.bi.getFinancialKpis();
  }
}
