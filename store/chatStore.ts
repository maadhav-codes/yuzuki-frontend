/** biome-ignore-all assist/source/useSortedKeys: start with data (state) and then actions  */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ChatMessage = {
  id: string;
  text: string;
  type: 'user' | 'ai';
  createdAt: number;
};

interface ChatState {
  messages: ChatMessage[];
  addMessage: (message: ChatMessage) => void;
}

export const useChatStore = create<ChatState>()(
  persist(
    (set) => ({
      messages: [],
      addMessage: (message) =>
        set((state) => ({
          messages: [...state.messages, message],
        })),
    }),
    { name: 'yuzuki-storage' }
  )
);
