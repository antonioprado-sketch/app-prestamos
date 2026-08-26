import { Link } from 'react-router-dom';
import { CalculatorPage } from './CalculatorPage';

export function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-surface pb-[96px]">
      <header className="sticky top-0 z-40 flex h-16 w-full items-center gap-md bg-surface px-margin-mobile">
        <span className="font-headline-md text-headline-lg-mobile font-bold text-primary">
          Prestamitos
        </span>
        <div className="ml-auto flex items-center gap-sm">
          <Link
            to="/login"
            className="min-h-11 rounded-xl border border-primary px-3 py-2.5 text-center font-label-md text-label-md text-primary transition-colors hover:bg-primary-light focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            Iniciar sesión
          </Link>
          <Link
            to="/register"
            className="min-h-11 rounded-xl bg-primary px-3 py-2.5 text-center font-label-md text-label-md text-white transition-colors hover:bg-primary-dark focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
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