import { Link } from 'react-router-dom';
import type { Role } from '../../store/auth';
import { useAuth } from '../../store/auth';
import { Button } from '../../components/ui/Button';

const titles: Record<Role, string> = {
  CLIENT: 'Panel del Cliente',
  COLLECTOR: 'Panel del Cobrador',
  ADMIN: 'Panel del Administrador',
};

const messages: Record<Role, string> = {
  CLIENT: 'Próximas fechas de pago',
  COLLECTOR: 'Clientes asignados',
  ADMIN: 'Resumen general',
};

export function DashboardShell({ role }: { role: Role }) {
  const { logout } = useAuth();

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <main className="flex flex-1 flex-col items-center justify-center gap-2 p-4 text-center">
        <h1 className="text-xl font-bold text-secondary">{titles[role]}</h1>
        <p className="text-secondary">{messages[role]}</p>
        {role === 'CLIENT' && (
          <Link to="/calculadora" className="mt-4 w-full max-w-xs">
            <Button type="button" className="w-full">
              Solicitar o continuar mi préstamo
            </Button>
          </Link>
        )}
        {role === 'ADMIN' && (
          <Link to="/admin/solicitudes" className="mt-4 w-full max-w-xs">
            <Button type="button" className="w-full">
              Revisar solicitudes
            </Button>
          </Link>
        )}
        <Button variant="ghost" onClick={() => logout()} className="mt-6">
          Cerrar sesión
        </Button>
      </main>
      <nav className="flex justify-around border-t border-gray-200 bg-white py-2">
        <span className="text-sm text-primary">Inicio</span>
        <span className="text-sm text-secondary">
          {role === 'CLIENT' ? 'Pagos' : role === 'COLLECTOR' ? 'Clientes' : 'Usuarios'}
        </span>
        <span className="text-sm text-secondary">Perfil</span>
      </nav>
    </div>
  );
}
