import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import {
  clearRefreshCookieOptions,
  REFRESH_COOKIE_NAME,
  refreshCookieOptions,
} from './refresh-cookie';

@Controller('api/v1/auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  register(@Body() dto: RegisterDto, @Req() req: Request) {
    return this.auth.register(
      dto,
      req.ip ?? '',
      req.headers['user-agent'] ?? '',
    );
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { refreshToken, ...body } = await this.auth.login(
      dto.phone,
      dto.password,
      req.ip ?? '',
      req.headers['user-agent'] ?? '',
    );
    res.cookie(REFRESH_COOKIE_NAME, refreshToken, refreshCookieOptions());
    return body;
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const raw = req.cookies?.[REFRESH_COOKIE_NAME];
    if (!raw) throw new UnauthorizedException('Sesión inválida o expirada');
    const { refreshToken, ...body } = await this.auth.refresh(
      raw,
      req.ip ?? '',
      req.headers['user-agent'] ?? '',
    );
    res.cookie(REFRESH_COOKIE_NAME, refreshToken, refreshCookieOptions());
    return body;
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const raw = req.cookies?.[REFRESH_COOKIE_NAME];
    if (raw) await this.auth.logout(raw);
    res.clearCookie(REFRESH_COOKIE_NAME, clearRefreshCookieOptions());
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @Body() dto: ChangePasswordDto,
    @CurrentUser() user: { phone: string },
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { refreshToken, ...body } = await this.auth.changePassword(
      user.phone,
      dto.currentPassword,
      dto.newPassword,
      req.ip ?? '',
      req.headers['user-agent'] ?? '',
    );
    res.cookie(REFRESH_COOKIE_NAME, refreshToken, refreshCookieOptions());
    return body;
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.ACCEPTED)
  async forgotPassword(@Body() dto: ForgotPasswordDto, @Req() req: Request) {
    await this.auth.forgotPassword(
      dto.phone,
      req.ip ?? '',
      req.headers['user-agent'] ?? '',
    );
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  resetPassword(@Body() dto: ResetPasswordDto, @Req() req: Request) {
    return this.auth.resetPassword(
      dto.phone,
      dto.code,
      dto.newPassword,
      req.ip ?? '',
      req.headers['user-agent'] ?? '',
    );
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: { phone: string }) {
    return this.auth.me(user.phone);
  }
}
