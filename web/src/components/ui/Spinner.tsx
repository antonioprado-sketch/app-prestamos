export function Spinner() {
  return (
    <div
      role="status"
      aria-label="Cargando"
      className="h-8 w-8 animate-spin rounded-full border-4 border-primary-light border-t-primary"
    />
  );
}
