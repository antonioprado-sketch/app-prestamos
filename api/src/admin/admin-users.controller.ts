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
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { AdminUsersService } from './admin-users.service';
import { ChangeUserRoleDto } from './dto/change-user-role.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('api/v1/admin/users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminUsersController {
  constructor(private readonly adminUsers: AdminUsersService) {}

  @Get()
  async findAll(
    @Query('role') role?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.adminUsers.findAll({ role, status, search });
  }

  @Post(':phone/reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(
    @Param('phone') phone: string,
    @Body() dto: ResetPasswordDto,
    @CurrentUser() user: { phone: string },
    @Req() req: Request,
  ) {
    return this.adminUsers.resetPassword(
      user.phone,
      phone,
      dto.newPassword,
      req.ip ?? '',
      req.headers['user-agent'] ?? '',
    );
  }

  @Patch(':phone/role')
  async changeRole(
    @Param('phone') phone: string,
    @Body() dto: ChangeUserRoleDto,
    @CurrentUser() user: { phone: string },
    @Req() req: Request,
  ) {
    return this.adminUsers.changeRole(
      user.phone,
      phone,
      dto.role,
      req.ip ?? '',
      req.headers['user-agent'] ?? '',
    );
  }

  @Delete(':phone')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteUser(
    @Param('phone') phone: string,
    @CurrentUser() user: { phone: string },
    @Req() req: Request,
  ) {
    await this.adminUsers.deleteUser(user.phone, phone, req.ip ?? '', req.headers['user-agent'] ?? '');
  }
}
