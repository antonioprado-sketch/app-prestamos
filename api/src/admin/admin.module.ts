import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AdminLoansController } from './admin-loans.controller';
import { AdminLoansService } from './admin-loans.service';
import { AdminCollectorsController } from './admin-collectors.controller';
import { AdminCollectorsService } from './admin-collectors.service';
import { AdminCustomersController } from './admin-customers.controller';
import { AdminCustomersService } from './admin-customers.service';
import { AdminConfigurationController } from './admin-configuration.controller';
import { AdminConfigurationService } from './admin-configuration.service';
import { ScoreModule } from '../score/score.module';

@Module({
  imports: [JwtModule.register({}), ScoreModule],
  controllers: [
    AdminLoansController,
    AdminCollectorsController,
    AdminCustomersController,
    AdminConfigurationController,
  ],
  providers: [
    AdminLoansService,
    AdminCollectorsService,
    AdminCustomersService,
    AdminConfigurationService,
  ],
})
export class AdminModule {}
