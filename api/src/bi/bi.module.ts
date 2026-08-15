import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { BiController } from './bi.controller';
import { BiService } from './bi.service';

@Module({
  imports: [JwtModule.register({})],
  controllers: [BiController],
  providers: [BiService],
})
export class BiModule {}
