import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { AdminConfigurationService } from './admin-configuration.service';
import { UpdateBusinessRulesDto } from './dto/update-business-rules.dto';
import { UpdateEmailConfigDto } from './dto/update-email-config.dto';
import { SendTestEmailDto } from './dto/send-test-email.dto';
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

  @Get('email')
  async getEmailConfig() {
    return this.adminConfiguration.getEmailConfig();
  }

  @Put('email')
  async updateEmailConfig(
    @Body() dto: UpdateEmailConfigDto,
    @CurrentUser() user: { phone: string },
    @Req() req: Request,
  ) {
    return this.adminConfiguration.updateEmailConfig(
      user.phone,
      dto,
      req.ip ?? '',
      req.headers['user-agent'] ?? '',
    );
  }

  @Post('email/test')
  @HttpCode(HttpStatus.OK)
  async sendTestEmail(
    @Body() dto: SendTestEmailDto,
    @CurrentUser() user: { phone: string },
    @Req() req: Request,
  ) {
    return this.adminConfiguration.sendTestEmail(
      user.phone,
      dto,
      req.ip ?? '',
      req.headers['user-agent'] ?? '',
    );
  }
}
