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
  hasMoreMessages: boolean;
  maxMessagesLimit: number;
  setSessionId: (sessionId: number | null) => void;
  setMessages: (messages: MessageRead[] | ((prev: MessageRead[]) => MessageRead[])) => void;
  setLoadingMessages: (loadingMessages: boolean) => void;
  setWsState: (wsState: WebSocketState) => void;
  setReconnectInSec: (reconnectInSec: number | null) => void;
  decrementReconnectInSec: () => void;
  setChatError: (chatError: string | null) => void;
  setIsReplying: (isReplying: boolean) => void;
  setHasFirstChunk: (hasFirstChunk: boolean) => void;
  setHasMoreMessages: (hasMoreMessages: boolean) => void;
  setMaxMessagesLimit: (maxMessagesLimit: number) => void;
  trimMessages: () => void;
  resetChatState: () => void;
}

const initialState = {
  chatError: null,
  hasFirstChunk: false,
  hasMoreMessages: false,
  isReplying: false,
  loadingMessages: true,
  maxMessagesLimit: 10,
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
  setHasMoreMessages: (hasMoreMessages) => set({ hasMoreMessages }),
  setIsReplying: (isReplying) => set({ isReplying }),
  setLoadingMessages: (loadingMessages) => set({ loadingMessages }),
  setMaxMessagesLimit: (maxMessagesLimit) => set({ maxMessagesLimit }),
  setMessages: (messages) =>
    set((state) => {
      const nextMessages = typeof messages === 'function' ? messages(state.messages) : messages;
      if (nextMessages.length > state.maxMessagesLimit) {
        return {
          hasMoreMessages: true,
          messages: nextMessages.slice(nextMessages.length - state.maxMessagesLimit),
        };
      }
      return { messages: nextMessages };
    }),
  setReconnectInSec: (reconnectInSec) => set({ reconnectInSec }),
  setSessionId: (sessionId) => set({ sessionId }),
  setWsState: (wsState) => set({ wsState }),
  trimMessages: () =>
    set((state) => {
      if (state.messages.length > state.maxMessagesLimit) {
        return {
          hasMoreMessages: true,
          messages: state.messages.slice(state.messages.length - state.maxMessagesLimit),
        };
      }
      return {};
    }),
}));
