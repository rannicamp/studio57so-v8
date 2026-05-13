"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

export default function ClientPermissionGuard({ recurso, children }) {
  const { hasPermission, loading: authLoading } = useAuth();
  const router = useRouter();

  const canView = hasPermission(recurso, 'pode_ver');

  useEffect(() => {
    if (!authLoading && !canView) {
      router.push('/');
    }
  }, [authLoading, canView, router]);

  if (authLoading || !canView) return null;

  return <>{children}</>;
}
