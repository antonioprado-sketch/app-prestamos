import { test, expect } from '@playwright/test';

// Flujo cliente feliz contra el stack Docker real (Nginx + API + MySQL + MinIO),
// no contra un dev server suelto — mismo criterio que ya detectó el 413 de Nginx
// y validó la CSP (ver CLAUDE.md). Un teléfono aleatorio por corrida evita
// colisiones con datos de sesiones anteriores.

function randomPhone(): string {
  let digits = '';
  for (let i = 0; i < 10; i++) digits += Math.floor(Math.random() * 10);
  return digits;
}

// Próxima fecha (lunes o viernes) válida para el modelo semanal, en formato
// YYYY-MM-DD, calculada con las mismas reglas de calendario que loan-quote.ts.
function nextWeeklyOpeningDate(): string {
  const now = new Date();
  const date = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  while (date.getUTCDay() !== 1 && date.getUTCDay() !== 5) {
    date.setUTCDate(date.getUTCDate() + 1);
  }
  return date.toISOString().slice(0, 10);
}

function jpegBuffer(): Buffer {
  const buf = Buffer.alloc(100, 0);
  buf[0] = 0xff;
  buf[1] = 0xd8;
  buf[2] = 0xff;
  return buf;
}

test('cliente completa registro, cotización, onboarding, documentos y firma de pagaré', async ({
  page,
}) => {
  const phone = randomPhone();
  const password = 'Abcdef12!';

  // Registro
  await page.goto('/register');
  await page.getByLabel('Teléfono').fill(phone);
  await page.getByLabel('Contraseña', { exact: true }).fill(password);
  await page.getByLabel('Confirmar contraseña').fill(password);
  await page.getByRole('button', { name: 'Registrarme' }).click();
  await expect(page).toHaveURL(/\/app\/cliente/);

  // Cotizador
  await page.goto('/calculadora');
  await page.getByLabel('Monto a solicitar').fill('3000');
  await page.getByLabel('Fecha de apertura').fill(nextWeeklyOpeningDate());
  await page.getByRole('button', { name: 'Calcular' }).click();
  await expect(page.getByText('Calendario de pagos')).toBeVisible();

  // Crear solicitud (borrador)
  await page.getByRole('button', { name: 'Lo quiero' }).click();
  await expect(page.getByText(/Folio/)).toBeVisible();

  // Onboarding
  await page.getByRole('button', { name: 'Completar mis datos' }).click();
  await expect(page).toHaveURL(/\/onboarding/);
  await page.getByLabel('Nombres').fill('Juan');
  await page.getByLabel('Apellidos').fill('Pérez');
  await page.getByLabel('Nombre del aval').fill('María López');
  await page.getByLabel('Teléfono del aval').fill(randomPhone());
  await page.getByLabel('Calle').fill('Av. Reforma');
  await page.getByLabel('Número').fill('123');
  await page.getByLabel('Colonia').fill('Centro');
  await page.getByLabel('Código postal').fill('06000');
  await page.getByLabel('Ciudad').fill('CDMX');
  await page.getByLabel('Estado').fill('CDMX');
  await page.getByLabel('Referencias del domicilio').fill('Casa azul, portón negro');
  await page.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByText('Tus datos se guardaron correctamente.')).toBeVisible();

  // Documentos (INE frente/reverso + comprobante)
  await page.getByRole('link', { name: 'Continuar con mis documentos' }).click();
  await expect(page).toHaveURL(/\/documentos/);
  const fileInputs = page.locator('input[type="file"]');
  for (let i = 0; i < 3; i++) {
    await fileInputs.nth(i).setInputFiles({
      name: `doc-${i}.jpg`,
      mimeType: 'image/jpeg',
      buffer: jpegBuffer(),
    });
  }
  await expect(page.getByText('Validado')).toHaveCount(3);

  // Pagaré: firma + envío (cierra la solicitud, único prerequisito es onboarding completo)
  await page.goto('/pagare');
  await page.getByLabel('Nombre completo').fill('Juan Pérez');
  const canvas = page.locator('canvas');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('No se encontró el canvas de firma');
  await page.mouse.move(box.x + 20, box.y + 20);
  await page.mouse.down();
  await page.mouse.move(box.x + 100, box.y + 60);
  await page.mouse.move(box.x + 180, box.y + 20);
  await page.mouse.up();
  await page.getByRole('button', { name: 'Firmar y enviar solicitud' }).click();

  await expect(page.getByText('Tu solicitud está siendo procesada.')).toBeVisible();
  await expect(page.getByText('El pagaré quedó firmado y guardado.')).toBeVisible();
});
