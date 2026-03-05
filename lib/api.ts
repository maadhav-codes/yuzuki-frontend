import type { MessageCreate, MessageRead, MessageUpdate, SessionRead } from '@/types/api';
import { supabase } from '@/utils/supabase/client';

const API_BASE = '/backend';

async function getAuthHeader(): Promise<string | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token || null;
}

async function authFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
  const token = await getAuthHeader();
  if (!token) throw new Error('Not authenticated');

  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    ...options.headers,
  };

  const response = await fetch(url, { ...options, headers });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
  }

  if (response.status === 204) return {} as T;
  return response.json();
}

export const api = {
  createMessage: async (sessionId: number, data: MessageCreate): Promise<MessageRead> => {
    return authFetch<MessageRead>(`${API_BASE}/sessions/${sessionId}/messages`, {
      body: JSON.stringify(data),
      method: 'POST',
    });
  },
  createSession: async (): Promise<SessionRead> => {
    return authFetch<SessionRead>(`${API_BASE}/sessions`, {
      method: 'POST',
    });
  },

  deleteMessage: async (messageId: number): Promise<void> => {
    return authFetch<void>(`${API_BASE}/messages/${messageId}`, {
      method: 'DELETE',
    });
  },

  getCurrentSession: async (): Promise<SessionRead> => {
    return authFetch<SessionRead>(`${API_BASE}/sessions/current`);
  },
  getMessages: async (sessionId: number, limit = 10, offset = 0): Promise<MessageRead[]> => {
    return authFetch<MessageRead[]>(
      `${API_BASE}/sessions/${sessionId}/messages?limit=${limit}&offset=${offset}`
    );
  },

  updateMessage: async (messageId: number, data: MessageUpdate): Promise<MessageRead> => {
    return authFetch<MessageRead>(`${API_BASE}/messages/${messageId}`, {
      body: JSON.stringify(data),
      method: 'PATCH',
    });
  },
};
