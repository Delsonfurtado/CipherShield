import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';

export function ProtectedRoute() {
  const { user, isVaultLocked } = useAuthStore();

  if (!user || isVaultLocked) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
