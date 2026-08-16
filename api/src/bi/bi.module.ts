import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { BiController } from './bi.controller';
import { BiService } from './bi.service';
import { ScoreModule } from '../score/score.module';

@Module({
  imports: [JwtModule.register({}), ScoreModule],
  controllers: [BiController],
  providers: [BiService],
})
export class BiModule {}
