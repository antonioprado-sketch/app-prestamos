import {
  validateDocument,
  decodeSignaturePng,
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

function webm(size = 20): Buffer {
  const buf = Buffer.alloc(size, 0);
  buf[0] = 0x1a;
  buf[1] = 0x45;
  buf[2] = 0xdf;
  buf[3] = 0xa3;
  return buf;
}

function mp4(size = 20): Buffer {
  const buf = Buffer.alloc(size, 0);
  buf.write('ftyp', 4, 'ascii');
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

  it('acepta un WEBM válido para VIDEO_IDENTITY', () => {
    expect(validateDocument('VIDEO_IDENTITY', 'video/webm', webm())).toBe(
      'video/webm',
    );
  });

  it('acepta el mime declarado con parámetros de códec (MediaRecorder)', () => {
    expect(
      validateDocument('VIDEO_IDENTITY', 'video/webm;codecs=vp9,opus', webm()),
    ).toBe('video/webm');
  });

  it('acepta un MP4 válido para VIDEO_IDENTITY', () => {
    expect(validateDocument('VIDEO_IDENTITY', 'video/mp4', mp4())).toBe(
      'video/mp4',
    );
  });

  it('permite hasta 50MB para VIDEO_IDENTITY (por encima del tope de imágenes)', () => {
    const big = webm(MAX_DOCUMENT_SIZE_BYTES + 1);
    expect(() =>
      validateDocument('VIDEO_IDENTITY', 'video/webm', big),
    ).not.toThrow();
  });

  it('rechaza video que excede el máximo de 50MB', () => {
    const big = webm(50 * 1024 * 1024 + 1);
    expect(() => validateDocument('VIDEO_IDENTITY', 'video/webm', big)).toThrow(
      DocumentValidationError,
    );
  });

  it('rechaza cuando el mime declarado no coincide con los magic bytes (spoofing)', () => {
    expect(() => validateDocument('INE_FRONT', 'image/png', jpeg())).toThrow(
      DocumentValidationError,
    );
  });

  it('acepta un JPEG válido para COLLECTOR_DOC', () => {
    expect(validateDocument('COLLECTOR_DOC', 'image/jpeg', jpeg())).toBe(
      'image/jpeg',
    );
  });

  it('rechaza video para COLLECTOR_DOC (solo fotos)', () => {
    expect(() =>
      validateDocument('COLLECTOR_DOC', 'video/webm', webm()),
    ).toThrow(DocumentValidationError);
  });

  it('rechaza COLLECTOR_DOC que excede el máximo de 5MB', () => {
    const big = jpeg(MAX_DOCUMENT_SIZE_BYTES + 1);
    expect(() => validateDocument('COLLECTOR_DOC', 'image/jpeg', big)).toThrow(
      DocumentValidationError,
    );
  });
});

describe('decodeSignaturePng', () => {
  const validPngBase64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

  it('decodifica una firma PNG válida', () => {
    const buffer = decodeSignaturePng(
      `data:image/png;base64,${validPngBase64}`,
    );
    expect(buffer.length).toBeGreaterThan(0);
  });

  it('rechaza un string que no es data URL', () => {
    expect(() => decodeSignaturePng('no-es-una-data-url')).toThrow(
      DocumentValidationError,
    );
  });

  it('rechaza una data URL con mime distinto de PNG', () => {
    expect(() => decodeSignaturePng('data:image/jpeg;base64,AAAA')).toThrow(
      DocumentValidationError,
    );
  });

  it('rechaza contenido cuyo magic bytes no es PNG real', () => {
    const fakeBase64 = Buffer.from('no es un png').toString('base64');
    expect(() =>
      decodeSignaturePng(`data:image/png;base64,${fakeBase64}`),
    ).toThrow(DocumentValidationError);
  });
});
