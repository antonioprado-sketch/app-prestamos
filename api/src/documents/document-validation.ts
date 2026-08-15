/** Tipos que el cliente sube directamente. PAGARE se genera server-side y nunca pasa por acá. */
export type UploadableDocumentType = 'INE_FRONT' | 'INE_BACK' | 'ADDRESS_PROOF';

export class DocumentValidationError extends Error {}

export const MAX_DOCUMENT_SIZE_BYTES = 5 * 1024 * 1024;

const ALLOWED_MIME_BY_TYPE: Record<UploadableDocumentType, string[]> = {
  INE_FRONT: ['image/jpeg', 'image/png'],
  INE_BACK: ['image/jpeg', 'image/png'],
  ADDRESS_PROOF: ['image/jpeg', 'image/png', 'application/pdf'],
};

export function sniffMime(buffer: Buffer): string | null {
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return 'image/jpeg';
  }
  if (
    buffer.length >= 4 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return 'image/png';
  }
  if (buffer.length >= 4 && buffer.toString('ascii', 0, 4) === '%PDF') {
    return 'application/pdf';
  }
  return null;
}

/** Valida tamaño, magic bytes y coherencia con el mime declarado. Devuelve el mime verificado. */
export function validateDocument(
  type: UploadableDocumentType,
  declaredMime: string,
  buffer: Buffer,
): string {
  if (buffer.length === 0)
    throw new DocumentValidationError('El archivo está vacío');
  if (buffer.length > MAX_DOCUMENT_SIZE_BYTES) {
    throw new DocumentValidationError(
      'El archivo supera el máximo permitido de 5MB',
    );
  }

  const sniffed = sniffMime(buffer);
  if (!sniffed)
    throw new DocumentValidationError('Formato de archivo no reconocido');

  const allowed = ALLOWED_MIME_BY_TYPE[type];
  if (!allowed.includes(sniffed)) {
    throw new DocumentValidationError(
      `Formato no permitido para este tipo de documento (permitidos: ${allowed.join(', ')})`,
    );
  }

  if (declaredMime !== sniffed) {
    throw new DocumentValidationError(
      'El contenido del archivo no coincide con el tipo declarado',
    );
  }

  return sniffed;
}

const MAX_SIGNATURE_SIZE_BYTES = 1 * 1024 * 1024;
const SIGNATURE_DATA_URL = /^data:image\/png;base64,(.+)$/;

/** Decodifica y valida la firma dibujada en canvas (data URL PNG). */
export function decodeSignaturePng(dataUrl: string): Buffer {
  const match = SIGNATURE_DATA_URL.exec(dataUrl);
  if (!match) {
    throw new DocumentValidationError(
      'La firma debe ser una imagen PNG en formato data URL',
    );
  }
  const buffer = Buffer.from(match[1], 'base64');
  if (buffer.length === 0) {
    throw new DocumentValidationError('La firma está vacía');
  }
  if (buffer.length > MAX_SIGNATURE_SIZE_BYTES) {
    throw new DocumentValidationError(
      'La firma supera el máximo permitido de 1MB',
    );
  }
  if (sniffMime(buffer) !== 'image/png') {
    throw new DocumentValidationError(
      'El contenido de la firma no es un PNG válido',
    );
  }
  return buffer;
}
