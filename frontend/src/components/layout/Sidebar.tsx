import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  Shield,
  KeyRound,
  LayoutDashboard,
  Radio,
  Lock,
  Settings,
  HeartHandshake,
  Star,
  Trash2,
  Folder,
  ShieldAlert,
  Clock,
  RefreshCw,
  Plus,
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useVaultStore } from '@/stores/vaultStore';
import { useUIStore } from '@/stores/uiStore';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

export function Sidebar() {
  const { lockVault, user } = useAuthStore();
  const { items, folders, filterKey, setFilterKey, setSelectedFolder } = useVaultStore();
  const { openAddItem } = useUIStore();

  const totalActive = items.filter((i) => !i.is_deleted).length;
  const favoritesCount = items.filter((i) => i.is_favorite && !i.is_deleted).length;
  const weakCount = items.filter((i) => i.isWeak && !i.is_deleted).length;
  const reusedCount = items.filter((i) => i.isReused && !i.is_deleted).length;
  const trashCount = items.filter((i) => i.is_deleted).length;

  const navLinks = [
    { to: '/vault', label: 'Vault', icon: Lock },
    { to: '/generator', label: 'Generator', icon: KeyRound },
    { to: '/dashboard', label: 'Security Center', icon: LayoutDashboard },
    { to: '/breach', label: 'Breach Monitor', icon: Radio },
    { to: '/emergency', label: 'Emergency Access', icon: HeartHandshake },
    { to: '/settings', label: 'Settings', icon: Settings },
  ];

  return (
    <aside className="w-64 border-r bg-card/60 backdrop-blur-md flex flex-col h-screen select-none">
      {/* Brand */}
      <div className="h-16 flex items-center justify-between px-4 border-b">
        <div className="flex items-center gap-2.5 font-bold tracking-tight text-foreground">
          <div className="p-1.5 rounded-lg bg-primary/10 text-primary border border-primary/20">
            <Shield className="h-5 w-5" />
          </div>
          <span className="text-base font-extrabold bg-gradient-to-r from-violet-500 to-indigo-500 bg-clip-text text-transparent">
            CipherShield
          </span>
        </div>
        <Badge variant="outline" className="text-[10px] font-mono text-muted-foreground py-0">
          ZERO-K
        </Badge>
      </div>

      {/* Primary Navigation */}
      <div className="p-3 space-y-1">
        <Button
          onClick={() => openAddItem('login')}
          className="w-full justify-start gap-2 shadow-sm font-semibold mb-2"
          size="sm"
        >
          <Plus className="h-4 w-4" />
          New Item
        </Button>

        {navLinks.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-primary/15 text-primary font-semibold'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                }`
              }
            >
              <Icon className="h-4 w-4" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </div>

      <Separator />

      {/* Filters Section (Vault view shortcuts) */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground px-2">
            Vault Views
          </span>
          <div className="mt-1.5 space-y-0.5">
            <button
              onClick={() => {
                setFilterKey('all');
                setSelectedFolder(null);
              }}
              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded text-xs transition-colors ${
                filterKey === 'all' ? 'bg-accent text-foreground font-medium' : 'text-muted-foreground hover:bg-accent/50'
              }`}
            >
              <span className="flex items-center gap-2">
                <Lock className="h-3.5 w-3.5" />
                All Items
              </span>
              <span className="text-[11px]">{totalActive}</span>
            </button>

            <button
              onClick={() => {
                setFilterKey('favorites');
                setSelectedFolder(null);
              }}
              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded text-xs transition-colors ${
                filterKey === 'favorites' ? 'bg-accent text-foreground font-medium' : 'text-muted-foreground hover:bg-accent/50'
              }`}
            >
              <span className="flex items-center gap-2 text-amber-500">
                <Star className="h-3.5 w-3.5 fill-current" />
                Favorites
              </span>
              <span className="text-[11px]">{favoritesCount}</span>
            </button>

            <button
              onClick={() => {
                setFilterKey('weak');
                setSelectedFolder(null);
              }}
              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded text-xs transition-colors ${
                filterKey === 'weak' ? 'bg-accent text-foreground font-medium' : 'text-muted-foreground hover:bg-accent/50'
              }`}
            >
              <span className="flex items-center gap-2 text-orange-500">
                <ShieldAlert className="h-3.5 w-3.5" />
                Weak Passwords
              </span>
              {weakCount > 0 && (
                <Badge variant="destructive" className="h-4 px-1 text-[10px]">
                  {weakCount}
                </Badge>
              )}
            </button>

            <button
              onClick={() => {
                setFilterKey('reused');
                setSelectedFolder(null);
              }}
              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded text-xs transition-colors ${
                filterKey === 'reused' ? 'bg-accent text-foreground font-medium' : 'text-muted-foreground hover:bg-accent/50'
              }`}
            >
              <span className="flex items-center gap-2 text-yellow-500">
                <RefreshCw className="h-3.5 w-3.5" />
                Reused
              </span>
              {reusedCount > 0 && (
                <Badge variant="secondary" className="h-4 px-1 text-[10px]">
                  {reusedCount}
                </Badge>
              )}
            </button>

            <button
              onClick={() => {
                setFilterKey('trash');
                setSelectedFolder(null);
              }}
              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded text-xs transition-colors ${
                filterKey === 'trash' ? 'bg-accent text-foreground font-medium' : 'text-muted-foreground hover:bg-accent/50'
              }`}
            >
              <span className="flex items-center gap-2">
                <Trash2 className="h-3.5 w-3.5" />
                Trash
              </span>
              <span className="text-[11px]">{trashCount}</span>
            </button>
          </div>
        </div>

        {/* Folders List */}
        {folders.length > 0 && (
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground px-2">
              Folders
            </span>
            <div className="mt-1.5 space-y-0.5">
              {folders.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setSelectedFolder(f.id)}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-xs text-muted-foreground hover:bg-accent/50 transition-colors"
                >
                  <Folder className="h-3.5 w-3.5" style={{ color: f.color || undefined }} />
                  <span className="truncate">{f.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Lock Vault Bottom Bar */}
      <div className="p-3 border-t bg-card/40 flex items-center justify-between">
        <div className="flex flex-col min-w-0 pr-2">
          <span className="text-xs font-semibold truncate text-foreground">
            {user?.email || 'Logged in'}
          </span>
          <span className="text-[10px] text-muted-foreground">Keys in memory</span>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={lockVault}
          className="gap-1.5 text-xs border-primary/20 text-primary hover:bg-primary/10"
        >
          <Lock className="h-3.5 w-3.5" />
          Lock
        </Button>
      </div>
    </aside>
  );
}
