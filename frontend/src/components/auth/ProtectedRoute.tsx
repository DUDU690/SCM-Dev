import { Navigate, Outlet } from 'react-router-dom';
import { useAppSelector } from '@/store/hooks';
import type { UserRole } from '@/store/slices/authSlice';

interface Props {
  roles?: UserRole[];
}

export default function ProtectedRoute({ roles }: Props) {
  const { isAuthenticated, user } = useAppSelector((s) => s.auth);

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (roles && user && !roles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
