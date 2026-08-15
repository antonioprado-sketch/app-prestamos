import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { ScoreService } from './score.service';
import { UpdateScoreOverrideDto } from './dto/update-score-override.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('api/v1')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ScoreController {
  constructor(private readonly score: ScoreService) {}

  @Get('customers/me/score')
  @Roles('CLIENT')
  async getMyScore(@CurrentUser() user: { phone: string }) {
    return this.score.getForCustomer(user.phone);
  }

  @Get('admin/scores')
  @Roles('ADMIN')
  async getAllScores() {
    return this.score.getAll();
  }

  @Patch('admin/scores/:phone')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.OK)
  async setOverride(
    @Param('phone') phone: string,
    @Body() dto: UpdateScoreOverrideDto,
    @CurrentUser() user: { phone: string },
    @Req() req: Request,
  ) {
    return this.score.setOverride(
      user.phone,
      phone,
      dto.level,
      req.ip ?? '',
      req.headers['user-agent'] ?? '',
    );
  }
}
