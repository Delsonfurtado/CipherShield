/**
 * CipherShield — UI & Theme State Store
 */
import { create } from 'zustand';

type Theme = 'light' | 'dark' | 'system';

interface UIState {
  theme: Theme;
  commandPaletteOpen: boolean;
  itemFormOpen: boolean;
  itemFormMode: 'add' | 'edit';
  itemFormInitialData: any | null;
  clipboardWarning: string | null;

  setTheme: (theme: Theme) => void;
  setCommandPaletteOpen: (open: boolean) => void;
  openAddItem: (initialType?: string) => void;
  openEditItem: (item: any) => void;
  closeItemForm: () => void;
  setClipboardWarning: (msg: string | null) => void;
}

export const useUIStore = create<UIState>((set) => ({
  theme: (localStorage.getItem('ciphershield_theme') as Theme) || 'dark',
  commandPaletteOpen: false,
  itemFormOpen: false,
  itemFormMode: 'add',
  itemFormInitialData: null,
  clipboardWarning: null,

  setTheme: (theme: Theme) => {
    localStorage.setItem('ciphershield_theme', theme);
    if (theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    set({ theme });
  },

  setCommandPaletteOpen: (open: boolean) => set({ commandPaletteOpen: open }),

  openAddItem: (initialType = 'login') =>
    set({
      itemFormOpen: true,
      itemFormMode: 'add',
      itemFormInitialData: { type: initialType },
    }),

  openEditItem: (item: any) =>
    set({
      itemFormOpen: true,
      itemFormMode: 'edit',
      itemFormInitialData: item,
    }),

  closeItemForm: () => set({ itemFormOpen: false, itemFormInitialData: null }),

  setClipboardWarning: (msg: string | null) => set({ clipboardWarning: msg }),
}));
