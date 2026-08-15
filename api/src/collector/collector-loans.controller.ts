import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { CollectorLoansService } from './collector-loans.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('api/v1/collector/loans')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('COLLECTOR')
export class CollectorLoansController {
  constructor(private readonly collectorLoans: CollectorLoansService) {}

  @Get()
  async findAssigned(@CurrentUser() user: { phone: string }) {
    return this.collectorLoans.findAssigned(user.phone);
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: { phone: string },
  ) {
    return this.collectorLoans.findOne(user.phone, id);
  }
}
