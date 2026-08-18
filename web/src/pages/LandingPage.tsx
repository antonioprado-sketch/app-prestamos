import { Link } from 'react-router-dom';
import { CalculatorPage } from './CalculatorPage';

export function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-surface pb-[96px]">
      <header className="sticky top-0 z-40 flex h-16 w-full items-center bg-surface px-margin-mobile">
        <span className="font-headline-md text-headline-lg-mobile font-bold text-primary">
          Prestamitos
        </span>
        <div className="ml-auto flex gap-sm">
          <Link
            to="/login"
            className="rounded-lg px-2 py-1 font-label-md text-label-md text-accent transition-colors hover:bg-surface-container"
          >
            Iniciar sesión
          </Link>
          <Link
            to="/register"
            className="rounded-lg bg-secondary-container px-2 py-1 font-label-md text-label-md text-on-secondary-container transition-colors"
          >
            Registrarse
          </Link>
        </div>
      </header>

      <CalculatorPage embedded />

      <footer className="px-margin-mobile pt-2 text-center text-xs text-outline">
        <Link to="/cobrador" className="transition-colors hover:text-primary">
          Acceso cobrador
        </Link>
        <span className="mx-1">·</span>
        <Link to="/admin" className="transition-colors hover:text-primary">
          Acceso administrador
        </Link>
      </footer>
    </div>
  );
}