import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

@Module({
  imports: [JwtModule.register({})],
  controllers: [PaymentsController],
  providers: [PaymentsService],
})
export class PaymentsModule {}
