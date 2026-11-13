import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { ProtectedRoute } from './ProtectedRoute';
import { LoginPage } from '@/pages/auth/LoginPage';
import { RegisterPage } from '@/pages/auth/RegisterPage';
import { VaultPage } from '@/pages/vault/VaultPage';
import { GeneratorPage } from '@/pages/generator/GeneratorPage';
import { DashboardPage } from '@/pages/dashboard/DashboardPage';
import { BreachPage } from '@/pages/breach/BreachPage';
import { EmergencyPage } from '@/pages/emergency/EmergencyPage';
import { SettingsPage } from '@/pages/settings/SettingsPage';
import { SharedItemPage } from '@/pages/share/SharedItemPage';
import { useAuthStore } from '@/stores/authStore';

export function AppRoutes() {
  const { user } = useAuthStore();

  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/share/:id" element={<SharedItemPage />} />

      {/* Protected Vault Routes */}
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/vault" element={<VaultPage />} />
          <Route path="/generator" element={<GeneratorPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/breach" element={<BreachPage />} />
          <Route path="/emergency" element={<EmergencyPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Route>

      {/* Fallback root */}
      <Route
        path="/"
        element={<Navigate to={user ? "/vault" : "/login"} replace />}
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
