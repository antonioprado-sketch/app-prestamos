import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { CollectorLoansController } from './collector-loans.controller';
import { CollectorLoansService } from './collector-loans.service';
import { DocumentsModule } from '../documents/documents.module';

@Module({
  imports: [JwtModule.register({}), DocumentsModule],
  controllers: [CollectorLoansController],
  providers: [CollectorLoansService],
})
export class CollectorLoansModule {}
