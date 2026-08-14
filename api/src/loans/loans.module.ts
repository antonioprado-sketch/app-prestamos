import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { LoansController } from './loans.controller';
import { OptionalJwtAuthGuard } from '../common/guards/optional-jwt-auth.guard';

@Module({
  imports: [JwtModule.register({})],
  controllers: [LoansController],
  providers: [OptionalJwtAuthGuard],
})
export class LoansModule {}
