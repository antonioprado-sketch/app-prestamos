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
import { AdminDocumentsController } from './admin-documents.controller';
import { AdminBlacklistController } from './admin-blacklist.controller';
import { AdminUsersController } from './admin-users.controller';
import { AdminUsersService } from './admin-users.service';
import { ScoreModule } from '../score/score.module';
import { DocumentsModule } from '../documents/documents.module';

@Module({
  imports: [JwtModule.register({}), ScoreModule, DocumentsModule],
  controllers: [
    AdminLoansController,
    AdminCollectorsController,
    AdminCustomersController,
    AdminConfigurationController,
    AdminDocumentsController,
    AdminBlacklistController,
    AdminUsersController,
  ],
  providers: [
    AdminLoansService,
    AdminCollectorsService,
    AdminCustomersService,
    AdminConfigurationService,
    AdminUsersService,
  ],
})
export class AdminModule {}
