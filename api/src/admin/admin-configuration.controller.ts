import { Body, Controller, Get, Put, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AdminConfigurationService } from './admin-configuration.service';
import { UpdateBusinessRulesDto } from './dto/update-business-rules.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('api/v1/admin/configuration')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminConfigurationController {
  constructor(private readonly adminConfiguration: AdminConfigurationService) {}

  @Get('business-rules')
  async getBusinessRules() {
    return this.adminConfiguration.getBusinessRules();
  }

  @Put('business-rules')
  async updateBusinessRules(
    @Body() dto: UpdateBusinessRulesDto,
    @CurrentUser() user: { phone: string },
    @Req() req: Request,
  ) {
    return this.adminConfiguration.updateBusinessRules(
      user.phone,
      dto,
      req.ip ?? '',
      req.headers['user-agent'] ?? '',
    );
  }
}
