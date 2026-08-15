import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AdminLoansController } from './admin-loans.controller';
import { AdminLoansService } from './admin-loans.service';
import { AdminCollectorsController } from './admin-collectors.controller';
import { AdminCollectorsService } from './admin-collectors.service';

@Module({
  imports: [JwtModule.register({})],
  controllers: [AdminLoansController, AdminCollectorsController],
  providers: [AdminLoansService, AdminCollectorsService],
})
export class AdminModule {}
