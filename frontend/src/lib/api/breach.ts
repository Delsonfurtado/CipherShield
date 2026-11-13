import { apiClient } from './client';

export const breachApi = {
  checkPwnedPasswordPrefix: async (hashPrefix5: string): Promise<string> => {
    return apiClient<string>(`/breach/pwned-password?hash_prefix=${encodeURIComponent(hashPrefix5)}`);
  },

  checkEmailBreaches: (email: string) =>
    apiClient<{ email: string; breach_count: number; breaches: any[] }>(`/breach/email-breach?email=${encodeURIComponent(email)}`),

  scanUserBreaches: () =>
    apiClient<{ status: string; email: string; breaches_found: number; breaches: any[] }>('/breach/scan', {
      method: 'POST',
    }),
};
