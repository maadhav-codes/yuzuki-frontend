/** biome-ignore-all assist/source/useSortedKeys: start with data (state) and then actions  */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ChatState {
  messages: string[];
  addMessage: (message: string) => void;
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
