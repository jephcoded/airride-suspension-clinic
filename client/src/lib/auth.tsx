import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { api } from './api';
import { Spinner } from '../components/ui/misc';

export type Role = 'TECHNICIAN' | 'ADVISOR' | 'ADMIN';
export type Me = { id: string; name: string; email: string; role: Role };

export function useMe() {
  return useQuery({
    queryKey: ['me'],
    queryFn: () => api.get<Me>('/auth/me').then((r) => r.data),
    retry: false,
    staleTime: 5 * 60_000,
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return async () => {
    await api.post('/auth/logout');
    qc.clear();
    window.location.href = '/staff/login';
  };
}

export const isOffice = (me?: Me) => me?.role === 'ADMIN' || me?.role === 'ADVISOR';

export function RequireStaff({ children, roles }: { children: ReactNode; roles?: Role[] }) {
  const { data, isLoading } = useMe();
  const location = useLocation();
  if (isLoading) return <Spinner className="min-h-dvh" />;
  if (!data) return <Navigate to="/staff/login" replace state={{ from: location.pathname + location.search }} />;
  if (roles && !roles.includes(data.role)) return <Navigate to="/staff" replace />;
  return <>{children}</>;
}
