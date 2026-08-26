# Guía de usuario — AppPrestamitos

Plataforma de préstamos personales con tres roles: **cliente**, **cobrador** y **administrador**. La app es mobile-first y funciona como PWA (se puede instalar desde el navegador).

Accesos: la landing (`/`) es pública; cada rol entra por su propia ruta de login (`/cliente`, `/cobrador`, `/admin` — enlaces discretos en el pie de la landing).

---

## 1. Cliente

### 1.1 Registro y primer acceso
1. En la landing toca **Registrarse** (o `/register`).
2. Registra teléfono + contraseña (8–64 caracteres, ≥1 mayúscula, ≥1 número).
3. Al iniciar sesión, el sistema **obliga a cambiar la contraseña** en el primer login.

> Un teléfono vetado por el administrador no puede registrarse.

### 1.2 Calculadora y solicitud
- En `/calculadora` eliges el **monto** (slider de $500 en $500, hasta $20,000) y el **modelo** (Semanal = 20 pagos, Quincenal = 10 pagos). El pago estimado se calcula en vivo.
- El **tope máximo** depende de tu situación:
  - Cliente nuevo (primer préstamo): hasta $3,000.
  - Cliente con **crédito aprobado** (aumento): tu límite actual.
  - Cliente con historial: tope según tu **score** (verde sin tope, amarillo $3,000, naranja $2,000, rojo $1,000).
- Si ya tienes un préstamo `APPROVED`/`ACTIVE`, no puedes solicitar otro; al entrar vas directo a tu home.
- Al solicitar, el préstamo queda en **borrador** (`DRAFT`) hasta que completes el onboarding y firmes el pagaré.

### 1.3 Onboarding
Completa, en orden:
1. **Datos personales** (`/onboarding`): nombre, aval, dirección, referencias.
2. **Documentos** (`/documentos`): fotos de tu INE (frente y reverso) y comprobante de domicilio — **solo con la cámara** del dispositivo (no hay subida de archivos ni PDF).
3. **Video de identidad** (`/video`): breve video con tu rostro (procesado con MediaPipe en tu dispositivo).
4. **Pagaré** (`/pagare`): firmas en pantalla el pagaré con el detalle de tus cuotas; se genera un PDF firmado.

Al firmar, la solicitud pasa a **enviada** (`SUBMITTED`) y queda en revisión del administrador.

### 1.4 Seguimiento
- Tu home (`/app/cliente`, `DashboardShell` → `ClientHome`) muestra:
  - Si no tienes préstamo activo → CTA "Solicitar un préstamo" a `/calculadora`.
  - Si tienes `APPROVED`/`ACTIVE` → tarjeta "Tu préstamo actual" con **saldo pendiente** (`total - ΣpaidAmount`), **próximo pago** (fecha + importe restante de la primera cuota no `PAID`), **barra de progreso** % y **score** con anillo (`GREEN 100% / YELLOW 66% / ORANGE 33% / RED 10%`).
  - Estados intermedios: **En revisión** / **Requiere corrección** (ves el motivo del admin y puedes corregir y volver a firmar) antes de llegar a `APPROVED`.
  - **Activo** → pagando cuotas; **Liquidado** → pagado por completo (ya no aparece como activo).
- **Historial de pagos:** no hay página separada de "mis pagos". El avance se ve en el home (saldo/progreso) y en el calendario de la solicitud (`CalculatorPage` cuando hay `DRAFT`/`SUBMITTED`/`REQUIRES_CORRECTION`), donde cada cuota muestra `paidAmount`/`status` (`PENDING`/`PARTIAL`/`PAID`). El detalle cuota por cuota con multa se registra en `GET /loans/:id/payments` (visible para admin/cobrador; el cliente ve el efecto agregado en su home).
- Recibes **notificaciones** en la app (campana) y push al instalarla.

### 1.5 Aumentar mi crédito
Desde la calculadora puedes tocar **"Aumentar mi crédito"**:
1. Indicas cuánto más necesitas (múltiplo de $500, sin solicitud previa pendiente).
2. La solicitud se notifica a todos los administradores y cobradores.
3. El primero que la resuelve la **aprueba** (sube tu límite de crédito) o la **rechaza** con un motivo.
4. Sigues el estado de tus solicitudes desde la misma pantalla.

### 1.6 Ubicación y permisos
La app te pide consentimiento para **compartir tu ubicación** (para que el cobrador te encuentre) y para **recibir notificaciones push**. Ambos se pueden aceptar o declinar; el sistema lo recuerda.

---

## 2. Cobrador

### 2.1 Acceso
- Entra por `/cobrador` con tu teléfono y contraseña. Si te desactivan, el login lo bloquea.

### 2.2 Home (`/app/cobrador`)
- Resumen de tu día: préstamos asignados y saldo por cobrar.
- Botones: **Inicio** y **Clientes** (tu cartera).

### 2.3 Cartera (`/collector/cartera`)
- Lista los préstamos **asignados a ti** (solo los tuyos).
- Al abrir un préstamo ves: cliente, documento (pagaré), monto total, saldo pendiente y cuotas.
- Para cobrar:
  1. El **monto a cobrar viene precargado** (la cuota que toca).
  2. Usa los **botones "+/-" para sumar cuotas** (ej. si el cliente adelanta dos pagos) — no hay edición manual.
  3. Confirmas el pago; el sistema aplica la multa si hay atraso.
- Puedes **subir evidencia de cobro** (foto) y consultar la **ubicación** del cliente.
- La pestaña **"Aumentos de crédito"** te muestra las solicitudes de aumento: eres de los primeros que puede **aprobar** (sube el límite del cliente) o **rechazar** con nota. Una vez resuelta, ya no aparece.

### 2.4 Notificaciones
Recibes avisos cuando te asignan un préstamo nuevo o cuando un cliente solicita un aumento.

---

## 3. Administrador

### 3.1 Acceso
- Entra por `/admin`. El admin inicial viene de `.env` y **debe cambiar su contraseña** en el primer login.

### 3.2 Indicadores — BI (`/admin/indicadores`, home)
- KPIs del núcleo financiero: cartera, desembolsado, morosidad, clientes activos, etc.
- **Desglose por cobrador**.
- **Tendencia semanal** (gráfica).
- **Distribución por zona** (mapa).

### 3.3 Solicitudes (`/admin/solicitudes`)
- Bandeja de préstamos por estado (filtrable).
- Sobre cada solicitud: revisas documentos del cliente, pagaré y ubicación.
- Acciones:
  - **Aprobar** → notifica al cliente; queda pendiente de asignar cobrador.
  - **Rechazar** → con motivo (notificado al cliente).
  - **Pedir corrección** → el cliente corrige y vuelve a firmar.
  - **Asignar cobrador** (a préstamos aprobados/activos) → el cobrador recibe notificación.

### 3.4 Clientes (`/admin/clientes`)
- Buscar y ver clientes (datos, score, límite de crédito, préstamos, documentos).
- **Alta manual** de un cliente.
- **Marca "nuevo cliente"** (controla el tope de $3,000 del primer préstamo).
- Baja de un cliente (eliminación en cascada).

### 3.5 Usuarios (`/admin/usuarios`)
- Lista unificada de todos los usuarios (admin/cobrador/cliente) con rol y estado.
- **Reset de contraseña** (genera temporal y obliga a cambiarla en el siguiente login).
- **Cambiar rol** de un usuario.
- Activar/desactivar cobradores (el desactivado no puede iniciar sesión).

### 3.6 Configuración (`/admin/configuracion`)
- **Reglas de negocio** (editables en caliente):
  - Multa por día de atraso (`penalty.per_day`, default $50).
  - Umbrales de score en días (amarillo 7, naranja 15).
  - **Topes por color de score**: verde = sin tope (o un número), amarillo $3,000, naranja $2,000, rojo $1,000.
- **Correo (SMTP)**: configurar Gmail SMTP y **enviar un correo de prueba** desde el panel (no hace falta tocar `.env`).

### 3.7 Ubicaciones (`/admin/ubicaciones`)
- Mapa con la última ubicación de cada cliente.

### 3.8 Aumentos (`/admin/aumentos`)
- Solicitudes de aumento de crédito de los clientes.
- Como el cobrador, el primero que resuelve **aprueba** (sube `creditLimit` del cliente) o **rechaza** con nota. Toda resolución queda **auditada**.

### 3.9 Blacklist (API / próximamente UI)
- Veto de teléfonos (bloquea registro y solicitud de préstamos) vía API (`/admin/blacklist`).

---

## Notas generales

- **Multas**: se calculan por día de atraso sobre las cuotas vencidas; se cobran al registrar el siguiente pago.
- **Score**: se calcula del peor atraso histórico sobre préstamos aprobados/activos; el admin puede sobreescribirlo por cliente.
- **PWA**: la app se puede instalar y funciona offline parcial; los push requieren permisos del navegador.
- Si un préstamo está en **`REQUIRES_CORRECTION`**, el cliente lo ve en su home con el motivo y puede corregir y volver a firmar el pagaré.