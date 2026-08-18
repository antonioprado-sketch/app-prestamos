import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { DocumentsService } from '../documents/documents.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('api/v1/admin/documents')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminDocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @Get(':id/signed-url')
  async signedUrl(@Param('id') id: string) {
    return this.documents.signedUrlForAdmin(id);
  }
}
