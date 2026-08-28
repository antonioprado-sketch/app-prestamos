/** Tipos que el cliente o el cobrador suben directamente. PAGARE se genera server-side y nunca pasa por acá. */
export type UploadableDocumentType =
  | 'INE_FRONT'
  | 'INE_BACK'
  | 'ADDRESS_PROOF'
  | 'VIDEO_IDENTITY'
  | 'COLLECTOR_DOC';

export class DocumentValidationError extends Error {}

const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_VIDEO_SIZE_BYTES = 50 * 1024 * 1024;

export const MAX_DOCUMENT_SIZE_BYTES = MAX_IMAGE_SIZE_BYTES;

const MAX_SIZE_BY_TYPE: Record<UploadableDocumentType, number> = {
  INE_FRONT: MAX_IMAGE_SIZE_BYTES,
  INE_BACK: MAX_IMAGE_SIZE_BYTES,
  ADDRESS_PROOF: MAX_IMAGE_SIZE_BYTES,
  VIDEO_IDENTITY: MAX_VIDEO_SIZE_BYTES,
  COLLECTOR_DOC: MAX_IMAGE_SIZE_BYTES,
};

const ALLOWED_MIME_BY_TYPE: Record<UploadableDocumentType, string[]> = {
  INE_FRONT: ['image/jpeg', 'image/png'],
  INE_BACK: ['image/jpeg', 'image/png'],
  ADDRESS_PROOF: ['image/jpeg', 'image/png', 'application/pdf'],
  VIDEO_IDENTITY: ['video/webm', 'video/mp4'],
  COLLECTOR_DOC: ['image/jpeg', 'image/png'],
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
  if (
    buffer.length >= 4 &&
    buffer[0] === 0x1a &&
    buffer[1] === 0x45 &&
    buffer[2] === 0xdf &&
    buffer[3] === 0xa3
  ) {
    return 'video/webm';
  }
  if (buffer.length >= 8 && buffer.toString('ascii', 4, 8) === 'ftyp') {
    return 'video/mp4';
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

  const maxSize = MAX_SIZE_BY_TYPE[type];
  if (buffer.length > maxSize) {
    throw new DocumentValidationError(
      `El archivo supera el máximo permitido de ${Math.round(maxSize / (1024 * 1024))}MB`,
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

  // MediaRecorder declara mime con parámetros de códec (ej. "video/webm;codecs=vp9,opus");
  // solo nos importa el tipo base para esta comparación anti-spoofing.
  const declaredBaseMime = declaredMime.split(';')[0].trim().toLowerCase();
  const sniffedLower = sniffed.toLowerCase();
  // Busboy/multer a veces cae a text/plain u octet-stream cuando el Content-Type
  // trae parámetros con coma (ej. video/webm;codecs=vp8,opus). Si el sniff es
  // concluyente (video/webm|mp4) y está permitido para el tipo, aceptamos aunque
  // el declarado venga genérico, para no bloquear celulares reales.
  const GENERIC_FALLBACKS = ['text/plain', 'application/octet-stream', ''];
  if (declaredBaseMime !== sniffedLower) {
    if (!(GENERIC_FALLBACKS.includes(declaredBaseMime) && ['video/webm', 'video/mp4'].includes(sniffedLower))) {
      throw new DocumentValidationError(
        `El contenido del archivo no coincide con el tipo declarado (declarado=${declaredBaseMime}, detectado=${sniffedLower})`,
      );
    }
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
