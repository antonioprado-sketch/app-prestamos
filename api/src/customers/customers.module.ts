import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { CustomersController } from './customers.controller';
import { CustomersService } from './customers.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [JwtModule.register({}), AuthModule],
  controllers: [CustomersController],
  providers: [CustomersService],
})
export class CustomersModule {}
