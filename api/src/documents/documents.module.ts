import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [JwtModule.register({}), AuthModule],
  controllers: [DocumentsController],
  providers: [DocumentsService],
  exports: [DocumentsService],
})
export class DocumentsModule {}
