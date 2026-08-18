import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { LoansController } from './loans.controller';
import { LoansService } from './loans.service';
import { OptionalJwtAuthGuard } from '../common/guards/optional-jwt-auth.guard';
import { AuthModule } from '../auth/auth.module';
import { ScoreModule } from '../score/score.module';

@Module({
  imports: [JwtModule.register({}), AuthModule, ScoreModule],
  controllers: [LoansController],
  providers: [LoansService, OptionalJwtAuthGuard],
  exports: [LoansService],
})
export class LoansModule {}
