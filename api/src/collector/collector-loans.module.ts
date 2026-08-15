import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { CollectorLoansController } from './collector-loans.controller';
import { CollectorLoansService } from './collector-loans.service';

@Module({
  imports: [JwtModule.register({})],
  controllers: [CollectorLoansController],
  providers: [CollectorLoansService],
})
export class CollectorLoansModule {}
