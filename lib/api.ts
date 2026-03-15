import { jwtDecode } from 'jwt-decode';
import type { MessageCreate, MessageRead, MessageUpdate, SessionRead } from '@/types/api';
import { supabase } from '@/utils/supabase/client';

const API_BASE = '/backend';

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

type JwtPayload = {
  exp?: number;
};

function parseJwtPayload(token: string): JwtPayload | null {
  try {
    return jwtDecode<JwtPayload>(token);
  } catch {
    return null;
  }
}

function isTokenUsable(token: string): boolean {
  const payload = parseJwtPayload(token);
  if (!payload) return false;
  if (typeof payload.exp !== 'number') return false;
  return payload.exp * 1000 > Date.now() + 15_000;
}

async function getAuthHeader(): Promise<string | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token || null;
  if (!token) return null;
  return isTokenUsable(token) ? token : null;
}

async function authFetch<T>(url: string, options: RequestInit = {}, retries = 1): Promise<T> {
  const token = await getAuthHeader();
  if (!token) throw new ApiError('Not authenticated', 401);

  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    ...options.headers,
  };

  const response = await fetch(url, { ...options, headers });

  if (response.status === 401 && retries > 0) {
    const {
      data: { session },
      error,
    } = await supabase.auth.refreshSession();
    if (error || !session) {
      throw new ApiError('Session expired', 401);
    }
    return authFetch<T>(url, options, retries - 1);
  }

  if (!response.ok) {
    const parsedBody = await response.json().catch(() => null);
    const message =
      parsedBody && typeof parsedBody === 'object' && 'detail' in parsedBody
        ? String(parsedBody.detail)
        : `HTTP error! status: ${response.status}`;

    throw new ApiError(message, response.status);
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
  generateTTS: async (
    text: string
  ): Promise<{ success: boolean; audioUrl: string | null; note: string }> => {
    return authFetch<{
      success: boolean;
      audioUrl: string | null;
      note: string;
    }>(`${API_BASE}/voice/tts`, {
      body: JSON.stringify({ text }),
      method: 'POST',
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
