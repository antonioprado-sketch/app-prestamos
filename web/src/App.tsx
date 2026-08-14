import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './store/auth';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { ChangePasswordPage } from './pages/ChangePasswordPage';
import { CalculatorPage } from './pages/CalculatorPage';
import { OnboardingPage } from './pages/OnboardingPage';
import { DashboardShell } from './pages/dashboard/DashboardShell';
import { Spinner } from './components/ui/Spinner';

function homeFor(role: string) {
  if (role === 'ADMIN') return '/app/admin';
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
      <Route path="/calculadora" element={<CalculatorPage />} />
      <Route
        path="/onboarding"
        element={
          user?.role === 'CLIENT' ? <OnboardingPage /> : <Navigate to={user ? homeFor(user.role) : '/login'} />
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
        element={user ? <DashboardShell role={user.role} /> : <Navigate to="/login" />}
      />
      <Route path="*" element={<Navigate to={user ? homeFor(user.role) : '/login'} />} />
    </Routes>
  );
}
