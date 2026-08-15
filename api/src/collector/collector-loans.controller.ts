import {
  BadRequestException,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import { CollectorLoansService } from './collector-loans.service';
import { DocumentsService } from '../documents/documents.service';
import { DocumentValidationError } from '../documents/document-validation';
import { LocationsService } from '../locations/locations.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

@Controller('api/v1/collector/loans')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('COLLECTOR')
export class CollectorLoansController {
  constructor(
    private readonly collectorLoans: CollectorLoansService,
    private readonly documents: DocumentsService,
    private readonly locations: LocationsService,
  ) {}

  @Get()
  async findAssigned(@CurrentUser() user: { phone: string }) {
    return this.collectorLoans.findAssigned(user.phone);
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: { phone: string },
  ) {
    return this.collectorLoans.findOne(user.phone, id);
  }

  @Get(':id/documents')
  async findDocuments(
    @Param('id') id: string,
    @CurrentUser() user: { phone: string },
  ) {
    const loan = await this.collectorLoans.findOne(user.phone, id);
    return this.documents.findForLoan(BigInt(loan.id));
  }

  @Get(':id/location')
  async findLocation(
    @Param('id') id: string,
    @CurrentUser() user: { phone: string },
  ) {
    const loan = await this.collectorLoans.findOne(user.phone, id);
    return this.locations.findLatestForCustomer(loan.customerPhone);
  }

  @Post(':id/documents')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES } }),
  )
  async uploadDocument(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: { phone: string },
    @Req() req: Request,
  ) {
    if (!file) throw new BadRequestException('Archivo requerido');
    const loan = await this.collectorLoans.findOne(user.phone, id);
    try {
      return await this.documents.uploadForClient(
        user.phone,
        loan.customerPhone,
        BigInt(loan.id),
        file,
        req.ip ?? '',
        req.headers['user-agent'] ?? '',
      );
    } catch (err) {
      if (err instanceof DocumentValidationError)
        throw new BadRequestException(err.message);
      throw err;
    }
  }
}
