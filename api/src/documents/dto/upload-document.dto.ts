import { IsIn } from 'class-validator';
import type { UploadableDocumentType } from '../document-validation';

const TYPES: UploadableDocumentType[] = [
  'INE_FRONT',
  'INE_BACK',
  'ADDRESS_PROOF',
  'VIDEO_IDENTITY',
];

export class UploadDocumentDto {
  @IsIn(TYPES)
  type: UploadableDocumentType;
}
