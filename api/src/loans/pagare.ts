// pdfkit es CJS puro (`export =`) sin tipos ESM; esta es la forma correcta de
// importarlo bajo `module: commonjs` sin esModuleInterop.
// eslint-disable-next-line @typescript-eslint/no-require-imports
import PDFDocument = require('pdfkit');

export interface PagareScheduleEntry {
  seq: number;
  dueDate: string;
  amount: number;
}

export interface PagareInput {
  folio: string;
  fullName: string;
  nombres: string | null;
  apellidos: string | null;
  calle: string | null;
  numero: string | null;
  colonia: string | null;
  cp: string | null;
  ciudad: string | null;
  estado: string | null;
  aval: string | null;
  avalPhone: string | null;
  amount: number;
  total: number;
  model: 'WEEKLY' | 'BIWEEKLY';
  schedule: PagareScheduleEntry[];
  signature: Buffer;
  signedAt: Date;
  ip: string;
}

const currency = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
});

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

/** Genera el PDF del pagaré. Nunca incluye la tasa de interés (R4/C9) — solo totales. */
export function renderPagarePdf(input: PagareInput): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const direccion = [
      [input.calle, input.numero].filter(Boolean).join(' '),
      input.colonia,
      `${input.ciudad ?? ''}, ${input.estado ?? ''} CP ${input.cp ?? ''}`,
    ]
      .filter(Boolean)
      .join(', ');

    doc.fontSize(18).text('PAGARÉ', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(10).text(`Folio: ${input.folio}`, { align: 'center' });
    doc.moveDown();

    doc
      .fontSize(11)
      .text(
        `Por este pagaré me obligo incondicionalmente a pagar a AppPrestamitos la cantidad de ` +
          `${currency.format(input.total)} (total a pagar), derivada de un préstamo por ` +
          `${currency.format(input.amount)}, mediante pagos ${
            input.model === 'WEEKLY' ? 'semanales' : 'quincenales'
          } conforme al calendario detallado a continuación.`,
      );
    doc.moveDown();

    doc.fontSize(11).text(`Deudor: ${input.fullName}`);
    doc.text(`Domicilio: ${direccion || 'No especificado'}`);
    doc.text(
      `Aval: ${input.aval ?? 'No especificado'} — Tel. ${input.avalPhone ?? 'No especificado'}`,
    );
    doc.moveDown();

    doc.fontSize(12).text('Calendario de pagos', { underline: true });
    doc.moveDown(0.3);
    doc.fontSize(9);
    for (const entry of input.schedule) {
      doc.text(
        `${entry.seq}. ${formatDate(entry.dueDate)} — ${currency.format(entry.amount)}`,
      );
    }
    doc.moveDown();

    doc.fontSize(11).text('Firma:');
    doc.moveDown(0.3);
    doc.image(input.signature, { fit: [200, 80] });
    doc.moveDown();
    doc.fontSize(9).text(`Firmado electrónicamente por ${input.fullName}`);
    doc.text(`Fecha: ${input.signedAt.toISOString()}`);
    doc.text(`IP: ${input.ip}`);

    doc.end();
  });
}
