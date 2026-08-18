import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { CreditIncreaseController } from './credit-increase.controller';
import { CreditIncreaseService } from './credit-increase.service';
import { LoansModule } from '../loans/loans.module';
import { ScoreModule } from '../score/score.module';

@Module({
  imports: [JwtModule.register({}), LoansModule, ScoreModule],
  controllers: [CreditIncreaseController],
  providers: [CreditIncreaseService],
})
export class CreditIncreaseModule {}
