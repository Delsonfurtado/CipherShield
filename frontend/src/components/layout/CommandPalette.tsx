import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Command } from 'cmdk';
import {
  Lock,
  KeyRound,
  LayoutDashboard,
  Radio,
  Plus,
  Shield,
  Search,
} from 'lucide-react';
import { useUIStore } from '@/stores/uiStore';
import { useVaultStore } from '@/stores/vaultStore';
import { useAuthStore } from '@/stores/authStore';

export function CommandPalette() {
  const navigate = useNavigate();
  const { commandPaletteOpen, setCommandPaletteOpen, openAddItem } = useUIStore();
  const { items, setActiveItemId } = useVaultStore();
  const { lockVault } = useAuthStore();
  const [search, setSearch] = useState('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(!commandPaletteOpen);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [commandPaletteOpen, setCommandPaletteOpen]);

  if (!commandPaletteOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 p-4 bg-background/80 backdrop-blur-sm animate-fade-in">
      <div
        className="fixed inset-0 -z-10"
        onClick={() => setCommandPaletteOpen(false)}
      />
      <div className="w-full max-w-lg rounded-xl border bg-card text-card-foreground shadow-2xl overflow-hidden animate-scale-up">
        <Command label="CipherShield Command Menu" className="w-full">
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <Command.Input
              value={search}
              onValueChange={setSearch}
              placeholder="Type a command or search passwords..."
              className="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          <Command.List className="max-h-[300px] overflow-y-auto p-2">
            <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
              No results found.
            </Command.Empty>

            {/* Quick Actions */}
            <Command.Group heading="Actions" className="text-xs font-semibold text-muted-foreground px-2 py-1.5">
              <Command.Item
                onSelect={() => {
                  setCommandPaletteOpen(false);
                  openAddItem('login');
                }}
                className="flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-foreground cursor-pointer hover:bg-accent"
              >
                <Plus className="h-4 w-4 text-primary" />
                <span>Add New Vault Item</span>
              </Command.Item>

              <Command.Item
                onSelect={() => {
                  setCommandPaletteOpen(false);
                  navigate('/generator');
                }}
                className="flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-foreground cursor-pointer hover:bg-accent"
              >
                <KeyRound className="h-4 w-4 text-primary" />
                <span>Open Password Generator</span>
              </Command.Item>

              <Command.Item
                onSelect={() => {
                  setCommandPaletteOpen(false);
                  lockVault();
                }}
                className="flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-foreground cursor-pointer hover:bg-accent"
              >
                <Lock className="h-4 w-4 text-primary" />
                <span>Lock Vault Now</span>
              </Command.Item>
            </Command.Group>

            {/* Vault Items */}
            {items.length > 0 && (
              <Command.Group heading="Vault Items" className="text-xs font-semibold text-muted-foreground px-2 py-1.5 mt-2">
                {items
                  .filter((i) => !i.is_deleted)
                  .slice(0, 10)
                  .map((item) => {
                    const data = item.decryptedData as any;
                    const title = data?.title || '(untitled)';
                    const username = data?.username || data?.email || '';

                    return (
                      <Command.Item
                        key={item.id}
                        onSelect={() => {
                          setCommandPaletteOpen(false);
                          setActiveItemId(item.id);
                          navigate('/vault');
                        }}
                        className="flex items-center justify-between px-2 py-1.5 rounded-md text-sm text-foreground cursor-pointer hover:bg-accent"
                      >
                        <div className="flex items-center gap-2">
                          <Lock className="h-3.5 w-3.5 opacity-60" />
                          <span className="font-medium">{title}</span>
                        </div>
                        {username && (
                          <span className="text-xs text-muted-foreground">{username}</span>
                        )}
                      </Command.Item>
                    );
                  })}
              </Command.Group>
            )}
          </Command.List>
        </Command>
      </div>
    </div>
  );
}
