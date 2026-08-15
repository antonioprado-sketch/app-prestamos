import { renderPagarePdf } from './pagare';

function tinyPng(): Buffer {
  // PNG 1x1 transparente válido, mínimo suficiente para pdfkit.
  return Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    'base64',
  );
}

describe('renderPagarePdf', () => {
  it('genera un PDF válido con los datos del préstamo', async () => {
    const buffer = await renderPagarePdf({
      folio: 'ppni-1234',
      fullName: 'Juan Pérez',
      nombres: 'Juan',
      apellidos: 'Pérez',
      calle: 'Reforma',
      numero: '123',
      colonia: 'Centro',
      cp: '06000',
      ciudad: 'CDMX',
      estado: 'CDMX',
      aval: 'María Pérez',
      avalPhone: '5511223344',
      amount: 1000,
      total: 1400,
      model: 'WEEKLY',
      schedule: [{ seq: 1, dueDate: '2026-08-24', amount: 70 }],
      signature: tinyPng(),
      signedAt: new Date('2026-08-15T00:00:00.000Z'),
      ip: '127.0.0.1',
    });

    expect(buffer.subarray(0, 4).toString('ascii')).toBe('%PDF');
    expect(buffer.length).toBeGreaterThan(500);
  });
});
