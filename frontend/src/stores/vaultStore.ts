/**
 * CipherShield — Decrypted Vault Zustand Store
 * Performs client-side encryption before writing and client-side decryption upon reading.
 */
import { create } from 'zustand';
import { vaultApi } from '@/lib/api/vault';
import { encryptVaultItem, decryptVaultItem } from '@/lib/crypto';
import {
  deleteLocalVaultItem,
  getLocalVaultItems,
  putLocalVaultItem,
  putLocalVaultItems,
} from '@/lib/storage/localVault';
import { useAuthStore } from './authStore';
import type {
  DecryptedVaultItem,
  Folder,
  ItemType,
  NewVaultItem,
  Tag,
  VaultItem,
  VaultItemData,
} from '@/types/vault';

interface VaultState {
  items: DecryptedVaultItem[];
  folders: Folder[];
  tags: Tag[];
  isLoading: boolean;
  searchQuery: string;
  selectedFolder: string | null;
  selectedType: ItemType | null;
  selectedTags: string[];
  filterKey: string;
  activeItemId: string | null;

  loadVault: () => Promise<void>;
  addItem: (item: NewVaultItem) => Promise<void>;
  updateItem: (id: string, updates: Partial<NewVaultItem>) => Promise<void>;
  deleteItem: (id: string) => Promise<void>;
  restoreItem: (id: string) => Promise<void>;
  permanentDeleteItem: (id: string) => Promise<void>;
  toggleFavorite: (id: string) => Promise<void>;

  setSearchQuery: (query: string) => void;
  setSelectedFolder: (folderId: string | null) => void;
  setSelectedType: (type: ItemType | null) => void;
  setFilterKey: (key: string) => void;
  setActiveItemId: (id: string | null) => void;
  getFilteredItems: () => DecryptedVaultItem[];
}

export const useVaultStore = create<VaultState>((set, get) => ({
  items: [],
  folders: [],
  tags: [],
  isLoading: false,
  searchQuery: '',
  selectedFolder: null,
  selectedType: null,
  selectedTags: [],
  filterKey: 'all',
  activeItemId: null,

  loadVault: async () => {
    const { vaultKey, user } = useAuthStore.getState();
    if (!vaultKey || !user) return;
    const userId = user.user_id || user.id;

    set({ isLoading: true });
    try {
      let rawItems: VaultItem[];
      let folders: Folder[] = [];
      let tags: Tag[] = [];
      if (user.auth_mode === 'local') {
        rawItems = await getLocalVaultItems(userId);
      } else {
        try {
          [rawItems, folders, tags] = await Promise.all([
            vaultApi.getItems(true), // include deleted for trash filter
            vaultApi.getFolders(),
            vaultApi.getTags(),
          ]);
        } catch (remoteError) {
          console.warn('Vault server is unavailable; loading the encrypted local copy:', remoteError);
          rawItems = await getLocalVaultItems(userId);
        }
        // Cache failure should not prevent a successful server load.
        if (rawItems) {
          try {
            await putLocalVaultItems(rawItems);
          } catch (cacheError) {
            console.warn('Could not cache encrypted vault data on this device:', cacheError);
          }
        }
      }

      // Decrypt items client-side
      const decryptedItems: DecryptedVaultItem[] = [];
      const passwordCounts = new Map<string, number>();

      for (const item of rawItems) {
        try {
          const decryptedData = await decryptVaultItem<VaultItemData>(
            vaultKey,
            item.encrypted_data,
            item.iv
          );

          // Check for password reuse
          const pwd = (decryptedData as any)?.password;
          if (pwd) {
            passwordCounts.set(pwd, (passwordCounts.get(pwd) || 0) + 1);
          }

          decryptedItems.push({
            ...item,
            decryptedData,
            data: decryptedData,
          });
        } catch (decryptErr) {
          console.warn(`Could not decrypt item ${item.id}:`, decryptErr);
        }
      }

      // Compute security attributes (weak, reused, old)
      const now = Date.now();
      const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000;

      for (const item of decryptedItems) {
        const pwd = (item.decryptedData as any)?.password;
        if (pwd) {
          item.isWeak = pwd.length < 12;
          item.isReused = (passwordCounts.get(pwd) || 0) > 1;
        }
        const updatedTime = new Date(item.updated_at).getTime();
        item.isOld = now - updatedTime > ninetyDaysMs;
      }

      set({
        items: decryptedItems,
        folders,
        tags,
        isLoading: false,
      });
    } catch (error) {
      console.error("Failed to load vault items:", error);
      set({ isLoading: false });
    }
  },

  addItem: async (newItem: NewVaultItem) => {
    const { vaultKey, user } = useAuthStore.getState();
    if (!vaultKey) throw new Error("Vault is locked");

    const { encrypted_data } = await encryptVaultItem(vaultKey, newItem.data as Record<string, unknown>);

    if (user?.auth_mode === 'local') {
      const now = new Date().toISOString();
      const item: VaultItem = {
        id: window.crypto.randomUUID(),
        user_id: user.user_id || user.id,
        type: newItem.type,
        encrypted_data,
        iv: encrypted_data.split('.')[0] ?? '',
        folder_id: newItem.folder_id ?? null,
        tags: newItem.tags ?? [],
        is_favorite: newItem.is_favorite ?? false,
        is_deleted: false,
        deleted_at: null,
        last_used_at: null,
        created_at: now,
        updated_at: now,
      };
      await putLocalVaultItem(item);
      const decryptedItem: DecryptedVaultItem = { ...item, decryptedData: newItem.data, data: newItem.data };
      set((state) => ({ items: [decryptedItem, ...state.items], activeItemId: decryptedItem.id }));
      return;
    }

    const created = await vaultApi.createItem({
      encrypted_data,
      item_type: newItem.type,
      folder_id: newItem.folder_id,
      is_favorite: newItem.is_favorite ?? false,
    });
    await putLocalVaultItem(created);

    const decryptedItem: DecryptedVaultItem = {
      ...created,
      decryptedData: newItem.data,
      data: newItem.data,
    };

    set((state) => ({
      items: [decryptedItem, ...state.items],
      activeItemId: decryptedItem.id,
    }));
  },

  updateItem: async (id: string, updates: Partial<NewVaultItem>) => {
    const { vaultKey, user } = useAuthStore.getState();
    if (!vaultKey) throw new Error("Vault is locked");

    const payload: any = {};
    if (updates.data) {
      const { encrypted_data } = await encryptVaultItem(vaultKey, updates.data as Record<string, unknown>);
      payload.encrypted_data = encrypted_data;
    }
    if (updates.type) payload.item_type = updates.type;
    if (updates.folder_id !== undefined) payload.folder_id = updates.folder_id;
    if (updates.is_favorite !== undefined) payload.is_favorite = updates.is_favorite;

    const currentItem = get().items.find((item) => item.id === id);
    if (user?.auth_mode === 'local' && currentItem) {
      const updatedAt = new Date().toISOString();
      const updatedItem: VaultItem = {
        ...currentItem,
        encrypted_data: payload.encrypted_data ?? currentItem.encrypted_data,
        type: updates.type ?? currentItem.type,
        folder_id: updates.folder_id !== undefined ? updates.folder_id : currentItem.folder_id,
        is_favorite: updates.is_favorite ?? currentItem.is_favorite,
        updated_at: updatedAt,
      };
      await putLocalVaultItem(updatedItem);
      set((state) => ({ items: state.items.map((item) => item.id === id
        ? { ...updatedItem, decryptedData: updates.data ?? item.decryptedData,
            data: updates.data ?? item.decryptedData }
        : item) }));
      return;
    }

    await vaultApi.updateItem(id, payload);
    if (currentItem) await putLocalVaultItem({
      ...currentItem,
      encrypted_data: payload.encrypted_data ?? currentItem.encrypted_data,
      type: updates.type ?? currentItem.type,
      folder_id: updates.folder_id !== undefined ? updates.folder_id : currentItem.folder_id,
      is_favorite: updates.is_favorite ?? currentItem.is_favorite,
      updated_at: new Date().toISOString(),
    });

    set((state) => ({
      items: state.items.map((item) => {
        if (item.id === id) {
          const newData = updates.data || item.decryptedData;
          return {
            ...item,
            ...payload,
            decryptedData: newData,
            data: newData,
            updated_at: new Date().toISOString(),
          };
        }
        return item;
      }),
    }));
  },

  deleteItem: async (id: string) => {
    const deletedAt = new Date().toISOString();
    const deletedItem = get().items.find((item) => item.id === id);
    if (useAuthStore.getState().user?.auth_mode !== 'local') await vaultApi.deleteItem(id);
    if (deletedItem) await putLocalVaultItem({ ...deletedItem, is_deleted: true, deleted_at: deletedAt });
    set((state) => ({
      items: state.items.map((item) =>
        item.id === id ? { ...item, is_deleted: true, deleted_at: deletedAt } : item
      ),
    }));
  },

  restoreItem: async (id: string) => {
    if (useAuthStore.getState().user?.auth_mode !== 'local') await vaultApi.restoreItem(id);
    const restoredItem = get().items.find((item) => item.id === id);
    if (restoredItem) await putLocalVaultItem({ ...restoredItem, is_deleted: false, deleted_at: null });
    set((state) => ({
      items: state.items.map((item) =>
        item.id === id ? { ...item, is_deleted: false, deleted_at: null } : item
      ),
    }));
  },

  permanentDeleteItem: async (id: string) => {
    const { user } = useAuthStore.getState();
    if (user?.auth_mode !== 'local') await vaultApi.permanentDeleteItem(id);
    if (user) await deleteLocalVaultItem(user.user_id || user.id, id);
    set((state) => ({
      items: state.items.filter((item) => item.id !== id),
      activeItemId: state.activeItemId === id ? null : state.activeItemId,
    }));
  },

  toggleFavorite: async (id: string) => {
    const item = get().items.find((i) => i.id === id);
    if (!item) return;
    const isFav = !item.is_favorite;
    if (useAuthStore.getState().user?.auth_mode !== 'local') {
      await vaultApi.updateItem(id, { is_favorite: isFav });
    }
    await putLocalVaultItem({ ...item, is_favorite: isFav, updated_at: new Date().toISOString() });
    set((state) => ({
      items: state.items.map((i) => (i.id === id ? { ...i, is_favorite: isFav } : i)),
    }));
  },

  setSearchQuery: (query: string) => set({ searchQuery: query }),
  setSelectedFolder: (folderId: string | null) => set({ selectedFolder: folderId }),
  setSelectedType: (type: ItemType | null) => set({ selectedType: type }),
  setFilterKey: (key: string) => set({ filterKey: key }),
  setActiveItemId: (id: string | null) => set({ activeItemId: id }),

  getFilteredItems: () => {
    const { items, searchQuery, selectedFolder, selectedType, filterKey } = get();
    return items.filter((item) => {
      // Trash filter check
      if (filterKey === 'trash') {
        if (!item.is_deleted) return false;
      } else {
        if (item.is_deleted) return false;
      }

      // Filter keys
      if (filterKey === 'favorites' && !item.is_favorite) return false;
      if (filterKey === 'weak' && !item.isWeak) return false;
      if (filterKey === 'reused' && !item.isReused) return false;
      if (filterKey === 'old' && !item.isOld) return false;
      if (filterKey === 'breached' && !item.isBreached) return false;

      // Folder filter
      if (selectedFolder && item.folder_id !== selectedFolder) return false;

      // Type filter
      if (selectedType && item.type !== selectedType) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const data = item.decryptedData as any;
        const text = [
          data?.title,
          data?.username,
          data?.email,
          data?.ssid,
          item.type,
        ].filter(Boolean).join(' ').toLowerCase();

        if (!text.includes(q)) return false;
      }

      return true;
    });
  },
}));
