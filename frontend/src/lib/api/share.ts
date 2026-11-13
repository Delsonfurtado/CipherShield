import { apiClient } from './client';

export const shareApi = {
  createShareLink: (payload: {
    encrypted_data: string;
    expires_in_hours: number;
    max_views?: number;
    require_password?: boolean;
    encrypted_access_password?: string;
  }) => apiClient<{ id: string; expires_at: string; max_views?: number; requires_passphrase: boolean }>('/share/links', {
    method: 'POST',
    body: JSON.stringify(payload),
  }),

  getSharedItem: (linkId: string, passphrase?: string) => {
    const q = passphrase ? `?passphrase=${encodeURIComponent(passphrase)}` : '';
    return apiClient<{
      id: string;
      encrypted_data: string;
      view_count: number;
      max_views?: number;
      expires_at: string;
    }>(`/share/links/${linkId}${q}`);
  },

  listUserShares: () => apiClient<any[]>('/share/links'),

  revokeShare: (linkId: string) => apiClient(`/share/links/${linkId}`, {
    method: 'DELETE',
  }),
};
