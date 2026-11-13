import React, { useState, useEffect } from 'react';
import { Search, Bell, Sun, Moon, Laptop, LogOut, Lock, Command } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useUIStore } from '@/stores/uiStore';
import { notificationsApi } from '@/lib/api/notifications';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function Header() {
  const { lockVault, logout, user } = useAuthStore();
  const { theme, setTheme, setCommandPaletteOpen, clipboardWarning } = useUIStore();
  const [unreadNotifications, setUnreadNotifications] = useState<any[]>([]);

  useEffect(() => {
    if (user?.auth_mode === 'local') {
      setUnreadNotifications([]);
      return;
    }

    // Fetch notifications
    notificationsApi.list(true).then((data) => {
      setUnreadNotifications(data || []);
    }).catch(() => {});
  }, [user?.auth_mode]);

  return (
    <header className="h-16 border-b bg-card/40 backdrop-blur-md px-6 flex items-center justify-between gap-4">
      {/* Search and Command Palette Trigger */}
      <div className="flex-1 max-w-md">
        <button
          onClick={() => setCommandPaletteOpen(true)}
          className="w-full h-9 flex items-center justify-between px-3 rounded-lg border bg-background/50 hover:bg-background text-muted-foreground text-xs shadow-sm transition-colors"
        >
          <div className="flex items-center gap-2">
            <Search className="h-3.5 w-3.5 text-muted-foreground" />
            <span>Search vault, passwords, tags...</span>
          </div>
          <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
            <span className="text-xs">⌘</span>K
          </kbd>
        </button>
      </div>

      {/* Clipboard Warning Banner */}
      {clipboardWarning && (
        <div className="hidden lg:flex items-center text-xs text-amber-500 bg-amber-500/10 border border-amber-500/20 px-3 py-1 rounded-full animate-fade-in">
          🔒 {clipboardWarning}
        </div>
      )}

      {/* Right controls */}
      <div className="flex items-center gap-2">
        {/* Theme switcher */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon" variant="ghost" className="h-9 w-9">
              {theme === 'dark' ? (
                <Moon className="h-4 w-4" />
              ) : theme === 'light' ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Laptop className="h-4 w-4" />
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="right">
            <DropdownMenuItem onClick={() => setTheme('light')}>Light</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme('dark')}>Dark</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme('system')}>System</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Notifications */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon" variant="ghost" className="h-9 w-9 relative">
              <Bell className="h-4 w-4" />
              {unreadNotifications.length > 0 && (
                <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-destructive animate-ping" />
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="right" className="w-80 p-2">
            <div className="flex items-center justify-between pb-2 border-b text-xs font-semibold">
              <span>Security Notifications</span>
              {unreadNotifications.length > 0 && (
                <button
                  onClick={() => {
                    if (user?.auth_mode !== 'local') notificationsApi.markAllRead();
                    setUnreadNotifications([]);
                  }}
                  className="text-primary hover:underline"
                >
                  Mark all read
                </button>
              )}
            </div>
            <div className="max-h-64 overflow-y-auto pt-2 space-y-2">
              {unreadNotifications.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">No new alerts</p>
              ) : (
                unreadNotifications.map((n) => (
                  <div key={n.id} className="p-2 rounded bg-muted/40 text-xs space-y-1">
                    <p className="font-medium text-foreground">{n.title}</p>
                    <p className="text-muted-foreground">{n.body}</p>
                  </div>
                ))
              )}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* User Account / Lock */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2 text-xs">
              <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              <span className="max-w-[120px] truncate">{user?.email?.split('@')[0] || 'User'}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="right" className="w-48">
            <DropdownMenuItem onClick={lockVault}>
              <Lock className="mr-2 h-4 w-4 text-primary" />
              Lock Vault
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logout} className="text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              Log Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
