import { apiClient } from './client';

export const notificationsApi = {
  list: (unreadOnly = false) => apiClient<any[]>(`/notifications?unread_only=${unreadOnly}`),
  markRead: (id: string) => apiClient(`/notifications/${id}/read`, { method: 'PUT' }),
  markAllRead: () => apiClient('/notifications/read-all', { method: 'PUT' }),
};
