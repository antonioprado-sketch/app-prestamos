import {
  BadRequestException,
  Body,
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
import { DocumentsService } from './documents.service';
import { UploadDocumentDto } from './dto/upload-document.dto';
import { DocumentValidationError } from './document-validation';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

@Controller('api/v1/documents')
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CLIENT')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES } }),
  )
  async upload(
    @Body() dto: UploadDocumentDto,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: { phone: string },
    @Req() req: Request,
  ) {
    if (!file) throw new BadRequestException('Archivo requerido');
    try {
      return await this.documents.upload(
        user.phone,
        dto.type,
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

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CLIENT')
  async findMine(@CurrentUser() user: { phone: string }) {
    return this.documents.findMine(user.phone);
  }

  @Get(':id/signed-url')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CLIENT')
  async signedUrl(
    @Param('id') id: string,
    @CurrentUser() user: { phone: string },
  ) {
    return this.documents.signedUrl(user.phone, id);
  }
}
