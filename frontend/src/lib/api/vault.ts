import { apiClient } from './client';
import type { Folder, ItemType, Tag, VaultItem } from '@/types/vault';

export const vaultApi = {
  getItems: (includeDeleted = false) =>
    apiClient<VaultItem[]>(`/vault/items?include_deleted=${includeDeleted}`),

  createItem: (payload: {
    encrypted_data: string;
    item_type: string;
    folder_id?: string | null;
    tag_ids?: string[];
    is_favorite?: boolean;
  }) => apiClient<VaultItem>('/vault/items', {
    method: 'POST',
    body: JSON.stringify(payload),
  }),

  getItem: (id: string) => apiClient<VaultItem>(`/vault/items/${id}`),

  updateItem: (id: string, payload: {
    encrypted_data?: string;
    item_type?: string;
    folder_id?: string | null;
    is_favorite?: boolean;
  }) => apiClient<VaultItem>(`/vault/items/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  }),

  deleteItem: (id: string) => apiClient(`/vault/items/${id}`, {
    method: 'DELETE',
  }),

  restoreItem: (id: string) => apiClient(`/vault/items/${id}/restore`, {
    method: 'POST',
  }),

  permanentDeleteItem: (id: string) => apiClient(`/vault/items/${id}/permanent`, {
    method: 'DELETE',
  }),

  getItemHistory: (id: string) => apiClient<any[]>(`/vault/items/${id}/history`),

  getFolders: () => apiClient<Folder[]>('/vault/folders'),

  createFolder: (payload: { encrypted_name: string; parent_id?: string | null; icon?: string; color?: string }) =>
    apiClient<Folder>('/vault/folders', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateFolder: (id: string, payload: { encrypted_name?: string; icon?: string; color?: string }) =>
    apiClient<Folder>(`/vault/folders/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  deleteFolder: (id: string) => apiClient(`/vault/folders/${id}`, {
    method: 'DELETE',
  }),

  getTags: () => apiClient<Tag[]>('/vault/tags'),

  createTag: (payload: { encrypted_name: string; color?: string }) =>
    apiClient<Tag>('/vault/tags', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  deleteTag: (id: string) => apiClient(`/vault/tags/${id}`, {
    method: 'DELETE',
  }),

  bulkAction: (payload: { item_ids: string[]; operation: string; target_folder_id?: string | null }) =>
    apiClient<{ success_count: number; message: string }>('/vault/items/bulk', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};
