import { apiClient } from './client';
import type { UserProfile } from '@/types/auth';

export const authApi = {
  getSalt: (email: string) =>
    apiClient<{ argon2_salt: string; kdf_params: any }>(`/auth/salt?email=${encodeURIComponent(email)}`),

  register: (payload: {
    email: string;
    password: string; // Auth key (base64)
    argon2_salt: string;
    encrypted_vault_key: string;
    kdf_params: any;
    display_name?: string;
  }) => apiClient<{ message: string; user_id: string; email: string }>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  }),

  login: (payload: {
    email: string;
    password: string; // Auth key (base64)
    totp_code?: string;
    backup_code?: string;
  }) => apiClient<{
    session?: { access_token: string; refresh_token: string; expires_in: number };
    user?: UserProfile;
    requires_2fa: boolean;
    temp_token?: string;
    message?: string;
  }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  }),

  getProfile: () => apiClient<UserProfile>('/auth/profile'),

  updateProfile: (data: { display_name?: string; preferences?: any }) =>
    apiClient('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  setup2FA: () => apiClient<{ secret: string; qr_code_uri: string; manual_entry_key: string }>('/auth/2fa/setup', {
    method: 'POST',
  }),

  verify2FA: (code: string) => apiClient<{ message: string; backup_codes: string[] }>('/auth/2fa/verify', {
    method: 'POST',
    body: JSON.stringify({ code }),
  }),

  disable2FA: (code: string, password: string) => apiClient('/auth/2fa/disable', {
    method: 'POST',
    body: JSON.stringify({ code, password }),
  }),

  changeMasterPassword: (payload: {
    current_password: string;
    new_encrypted_vault_key: string;
    new_argon2_salt: string;
    new_kdf_params?: any;
  }) => apiClient('/auth/change-master-password', {
    method: 'POST',
    body: JSON.stringify(payload),
  }),

  getSessions: () => apiClient<any[]>('/auth/sessions'),

  revokeSession: (sessionId: string) => apiClient(`/auth/sessions/${sessionId}`, {
    method: 'DELETE',
  }),

  deleteAccount: (password: string) => apiClient('/auth/account', {
    method: 'DELETE',
    body: JSON.stringify({ password, confirmation: 'DELETE MY ACCOUNT' }),
  }),
};
