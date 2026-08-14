import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { LoansController } from './loans.controller';
import { LoansService } from './loans.service';
import { OptionalJwtAuthGuard } from '../common/guards/optional-jwt-auth.guard';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [JwtModule.register({}), AuthModule],
  controllers: [LoansController],
  providers: [LoansService, OptionalJwtAuthGuard],
})
export class LoansModule {}
