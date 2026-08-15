import { Controller, Get, UseGuards } from '@nestjs/common';
import { ScoreService } from './score.service';
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
}
