import { create } from 'zustand';
import type { MessageRead } from '@/types/api';

export type WebSocketState = 'idle' | 'connecting' | 'open' | 'reconnecting' | 'closed';

interface ChatState {
  sessionId: number | null;
  messages: MessageRead[];
  loadingMessages: boolean;
  wsState: WebSocketState;
  reconnectInSec: number | null;
  chatError: string | null;
  isReplying: boolean;
  hasFirstChunk: boolean;
  setSessionId: (sessionId: number | null) => void;
  setMessages: (messages: MessageRead[] | ((prev: MessageRead[]) => MessageRead[])) => void;
  setLoadingMessages: (loadingMessages: boolean) => void;
  setWsState: (wsState: WebSocketState) => void;
  setReconnectInSec: (reconnectInSec: number | null) => void;
  decrementReconnectInSec: () => void;
  setChatError: (chatError: string | null) => void;
  setIsReplying: (isReplying: boolean) => void;
  setHasFirstChunk: (hasFirstChunk: boolean) => void;
  resetChatState: () => void;
}

const initialState = {
  chatError: null,
  hasFirstChunk: false,
  isReplying: false,
  loadingMessages: true,
  messages: [] as MessageRead[],
  reconnectInSec: null,
  sessionId: null,
  wsState: 'idle' as WebSocketState,
};

export const useChatStore = create<ChatState>((set) => ({
  ...initialState,
  decrementReconnectInSec: () =>
    set((state) => ({
      reconnectInSec:
        state.reconnectInSec && state.reconnectInSec > 0 ? state.reconnectInSec - 1 : 0,
    })),
  resetChatState: () =>
    set({
      ...initialState,
      loadingMessages: false,
      wsState: 'closed',
    }),
  setChatError: (chatError) => set({ chatError }),
  setHasFirstChunk: (hasFirstChunk) => set({ hasFirstChunk }),
  setIsReplying: (isReplying) => set({ isReplying }),
  setLoadingMessages: (loadingMessages) => set({ loadingMessages }),
  setMessages: (messages) =>
    set((state) => ({
      messages: typeof messages === 'function' ? messages(state.messages) : messages,
    })),
  setReconnectInSec: (reconnectInSec) => set({ reconnectInSec }),
  setSessionId: (sessionId) => set({ sessionId }),
  setWsState: (wsState) => set({ wsState }),
}));
