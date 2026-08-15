import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { LocationsController } from './locations.controller';
import { LocationsService } from './locations.service';

@Module({
  imports: [JwtModule.register({})],
  controllers: [LocationsController],
  providers: [LocationsService],
})
export class LocationsModule {}
