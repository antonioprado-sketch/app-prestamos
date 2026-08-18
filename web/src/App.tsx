import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './store/auth';
import { LoginPage } from './pages/LoginPage';
import { LandingPage } from './pages/LandingPage';
import { RegisterPage } from './pages/RegisterPage';
import { ChangePasswordPage } from './pages/ChangePasswordPage';
import { CalculatorPage } from './pages/CalculatorPage';
import { OnboardingPage } from './pages/OnboardingPage';
import { DocumentsPage } from './pages/DocumentsPage';
import { PagarePage } from './pages/PagarePage';
import { VideoIdentityPage } from './pages/VideoIdentityPage';
import { AdminLoansPage } from './pages/AdminLoansPage';
import { AdminCustomersPage } from './pages/AdminCustomersPage';
import { AdminUsersPage } from './pages/AdminUsersPage';
import { AdminConfigurationPage } from './pages/AdminConfigurationPage';
import { AdminLocationsPage } from './pages/AdminLocationsPage';
import { AdminBiPage } from './pages/AdminBiPage';
import { CollectorLoansPage } from './pages/CollectorLoansPage';
import { DashboardShell } from './pages/dashboard/DashboardShell';
import { Spinner } from './components/ui/Spinner';

function homeFor(role: string) {
  if (role === 'ADMIN') return '/admin/indicadores';
  if (role === 'COLLECTOR') return '/app/cobrador';
  return '/app/cliente';
}

export default function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/" element={user ? <Navigate to={homeFor(user.role)} replace /> : <LandingPage />} />
      <Route path="/calculadora" element={<CalculatorPage />} />
      <Route
        path="/cliente"
        element={user ? <Navigate to={homeFor(user.role)} /> : <LoginPage role="CLIENT" />}
      />
      <Route
        path="/cobrador"
        element={user ? <Navigate to={homeFor(user.role)} /> : <LoginPage role="COLLECTOR" />}
      />
      <Route
        path="/admin"
        element={user ? <Navigate to={homeFor(user.role)} /> : <LoginPage role="ADMIN" />}
      />
      <Route
        path="/onboarding"
        element={
          user?.role === 'CLIENT' ? <OnboardingPage /> : <Navigate to={user ? homeFor(user.role) : '/login'} />
        }
      />
      <Route
        path="/documentos"
        element={
          user?.role === 'CLIENT' ? <DocumentsPage /> : <Navigate to={user ? homeFor(user.role) : '/login'} />
        }
      />
      <Route
        path="/video"
        element={
          user?.role === 'CLIENT' ? <VideoIdentityPage /> : <Navigate to={user ? homeFor(user.role) : '/login'} />
        }
      />
      <Route
        path="/pagare"
        element={
          user?.role === 'CLIENT' ? <PagarePage /> : <Navigate to={user ? homeFor(user.role) : '/login'} />
        }
      />
      <Route
        path="/admin/solicitudes"
        element={
          user?.role === 'ADMIN' ? <AdminLoansPage /> : <Navigate to={user ? homeFor(user.role) : '/login'} />
        }
      />
      <Route
        path="/admin/clientes"
        element={
          user?.role === 'ADMIN' ? <AdminCustomersPage /> : <Navigate to={user ? homeFor(user.role) : '/login'} />
        }
      />
      <Route
        path="/admin/usuarios"
        element={
          user?.role === 'ADMIN' ? <AdminUsersPage /> : <Navigate to={user ? homeFor(user.role) : '/login'} />
        }
      />
      <Route
        path="/admin/configuracion"
        element={
          user?.role === 'ADMIN' ? <AdminConfigurationPage /> : <Navigate to={user ? homeFor(user.role) : '/login'} />
        }
      />
      <Route
        path="/admin/ubicaciones"
        element={
          user?.role === 'ADMIN' ? <AdminLocationsPage /> : <Navigate to={user ? homeFor(user.role) : '/login'} />
        }
      />
      <Route
        path="/admin/indicadores"
        element={
          user?.role === 'ADMIN' ? <AdminBiPage /> : <Navigate to={user ? homeFor(user.role) : '/login'} />
        }
      />
      <Route
        path="/collector/cartera"
        element={
          user?.role === 'COLLECTOR' ? <CollectorLoansPage /> : <Navigate to={user ? homeFor(user.role) : '/login'} />
        }
      />
      <Route path="/login" element={user ? <Navigate to={homeFor(user.role)} /> : <LoginPage />} />
      <Route
        path="/register"
        element={user ? <Navigate to={homeFor(user.role)} /> : <RegisterPage />}
      />
      <Route
        path="/change-password"
        element={
          user?.mustChangePassword ? (
            <ChangePasswordPage />
          ) : (
            <Navigate to={user ? homeFor(user.role) : '/login'} />
          )
        }
      />
      <Route
        path="/app/*"
        element={
          !user ? (
            <Navigate to="/login" />
          ) : user.role === 'ADMIN' ? (
            <Navigate to="/admin/indicadores" />
          ) : (
            <DashboardShell role={user.role} />
          )
        }
      />
      <Route path="*" element={<Navigate to={user ? homeFor(user.role) : '/login'} />} />
    </Routes>
  );
}
