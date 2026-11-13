/**
 * CipherShield — Master Application Layout
 * Sidebar, Header, Global Command Palette, Auto-Inactivity Locking, and Vault Item Modals.
 */
import React, { useEffect, useRef } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { CommandPalette } from './CommandPalette';
import { VaultItemForm } from '@/components/vault/VaultItemForm';
import { useAuthStore } from '@/stores/authStore';
import { useVaultStore } from '@/stores/vaultStore';

export function AppLayout() {
  const { isVaultLocked, user, lockVault } = useAuthStore();
  const { loadVault } = useVaultStore();
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Inactivity timeout: auto-lock vault after 5 minutes of no activity
  const resetTimer = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      lockVault();
    }, 5 * 60 * 1000);
  };

  useEffect(() => {
    // Activity events
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    events.forEach((e) => window.addEventListener(e, resetTimer));
    resetTimer();

    return () => {
      events.forEach((e) => window.removeEventListener(e, resetTimer));
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  // Load vault on mount if unlocked
  useEffect(() => {
    if (!isVaultLocked) {
      loadVault();
    }
  }, [isVaultLocked]);

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto relative">
          <Outlet />
        </main>
      </div>

      <CommandPalette />
      <VaultItemForm />
    </div>
  );
}
