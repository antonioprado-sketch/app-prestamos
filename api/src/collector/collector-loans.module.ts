import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { CollectorLoansController } from './collector-loans.controller';
import { CollectorLoansService } from './collector-loans.service';
import { DocumentsModule } from '../documents/documents.module';
import { LocationsModule } from '../locations/locations.module';

@Module({
  imports: [JwtModule.register({}), DocumentsModule, LocationsModule],
  controllers: [CollectorLoansController],
  providers: [CollectorLoansService],
})
export class CollectorLoansModule {}
