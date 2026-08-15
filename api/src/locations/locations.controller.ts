import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { LocationsService } from './locations.service';
import { RecordLocationDto } from './dto/record-location.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('api/v1/locations')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('CLIENT')
export class LocationsController {
  constructor(private readonly locations: LocationsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async record(
    @Body() dto: RecordLocationDto,
    @CurrentUser() user: { phone: string },
  ) {
    return this.locations.record(user.phone, dto);
  }
}
