import {
  validateDocument,
  DocumentValidationError,
  MAX_DOCUMENT_SIZE_BYTES,
} from './document-validation';

function jpeg(size = 10): Buffer {
  const buf = Buffer.alloc(size, 0);
  buf[0] = 0xff;
  buf[1] = 0xd8;
  buf[2] = 0xff;
  return buf;
}

function png(size = 10): Buffer {
  const buf = Buffer.alloc(size, 0);
  buf[0] = 0x89;
  buf[1] = 0x50;
  buf[2] = 0x4e;
  buf[3] = 0x47;
  return buf;
}

function pdf(size = 10): Buffer {
  const buf = Buffer.alloc(size, 0);
  buf.write('%PDF', 0, 'ascii');
  return buf;
}

describe('validateDocument', () => {
  it('acepta un JPEG válido para INE_FRONT', () => {
    expect(validateDocument('INE_FRONT', 'image/jpeg', jpeg())).toBe(
      'image/jpeg',
    );
  });

  it('acepta un PNG válido para INE_BACK', () => {
    expect(validateDocument('INE_BACK', 'image/png', png())).toBe('image/png');
  });

  it('acepta un PDF para ADDRESS_PROOF', () => {
    expect(validateDocument('ADDRESS_PROOF', 'application/pdf', pdf())).toBe(
      'application/pdf',
    );
  });

  it('rechaza PDF para INE_FRONT (no permitido)', () => {
    expect(() =>
      validateDocument('INE_FRONT', 'application/pdf', pdf()),
    ).toThrow(DocumentValidationError);
  });

  it('rechaza archivo vacío', () => {
    expect(() =>
      validateDocument('INE_FRONT', 'image/jpeg', Buffer.alloc(0)),
    ).toThrow(DocumentValidationError);
  });

  it('rechaza archivo que excede el máximo de 5MB', () => {
    const big = jpeg(MAX_DOCUMENT_SIZE_BYTES + 1);
    expect(() => validateDocument('INE_FRONT', 'image/jpeg', big)).toThrow(
      DocumentValidationError,
    );
  });

  it('rechaza contenido sin firma reconocible', () => {
    expect(() =>
      validateDocument(
        'INE_FRONT',
        'image/jpeg',
        Buffer.from('no es una imagen'),
      ),
    ).toThrow(DocumentValidationError);
  });

  it('rechaza cuando el mime declarado no coincide con los magic bytes (spoofing)', () => {
    expect(() => validateDocument('INE_FRONT', 'image/png', jpeg())).toThrow(
      DocumentValidationError,
    );
  });
});
