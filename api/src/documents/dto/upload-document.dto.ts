import { IsIn } from 'class-validator';
import type { DocumentType } from '@prisma/client';

const TYPES: DocumentType[] = ['INE_FRONT', 'INE_BACK', 'ADDRESS_PROOF'];

export class UploadDocumentDto {
  @IsIn(TYPES)
  type: DocumentType;
}
