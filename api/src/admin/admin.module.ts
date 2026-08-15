import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AdminLoansController } from './admin-loans.controller';
import { AdminLoansService } from './admin-loans.service';

@Module({
  imports: [JwtModule.register({})],
  controllers: [AdminLoansController],
  providers: [AdminLoansService],
})
export class AdminModule {}
