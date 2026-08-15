import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ScoreController } from './score.controller';
import { ScoreService } from './score.service';

@Module({
  imports: [JwtModule.register({})],
  controllers: [ScoreController],
  providers: [ScoreService],
})
export class ScoreModule {}
