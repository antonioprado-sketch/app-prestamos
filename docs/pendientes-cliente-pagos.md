# Pendientes — cliente stitch (P4)

Fecha: 2026-08-27
Módulo: `stitch/cliente` → `web/src/pages/dashboard/ClientPaymentsPage.tsx`

## P4 — “Pay Now” autopago del cliente
- **Diseño stitch:** `stitch/cliente/payment_schedule/code.html:201-206` muestra botón “Pay Now” / “Pay” en cada cuota (Overdue/Next).
- **Estado actual:** Implementado como **solo lectura** — botones deshabilitados con tooltip `“Tu cobrador registra el pago — P4 pendiente de definir autopago”` (`ClientPaymentsPage.tsx:148,177`).
- **Gap funcional:** Hoy `POST /api/v1/loans/:id/payments` solo lo usa `CollectorLoansPage` (cobrador) con `+/-` cuotas e `idempotencyKey`. No existe flujo `CLIENT` que se auto-cobre.
- **Opciones para consultar con negocio:**
  1. **Solo informativo (recomendado):** mantener deshabilitado y derivar a cobrador (sin cambio API).
  2. **Habilitar autopago:** permitir `CLIENT` llamar `POST /loans/:id/payments` con guard `ownership` (verificar `loan.customer_phone === user.phone`) + validar `status ACTIVE/APPROVED` + idempotencia. Requiere actualizar `PaymentsService` y `LoansController` RBAC y test e2e.
- **Riesgo regresión:** Opción 2 toca `api/src/payments` y `api/src/loans` (RBAC por ownership, 404 vs 403) + manejo de dinero `DECIMAL(10,2)`.
- **Decisión:** Pendiente de confirmación del cliente. No se toca API hasta “confirmo P4”.

Otros pendientes ya resueltos:
- P1 Guía multas → implementada en `CalculatorPage.tsx: PenaltyGuide` con +$50 (mapeable a `Configuration` `penaltyPerDay`).
- P2 Summary card → `CalculatorPage.tsx: LoanSummaryCard`.
- P3 Página pagos → `ClientPaymentsPage.tsx` + ruta `/app/cliente/pagos` + nav `DashboardShell.tsx:16`.
