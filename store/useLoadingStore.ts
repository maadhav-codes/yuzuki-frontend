import { create } from 'zustand';

interface LoadingState {
  authLoading: boolean;
  chatLoading: boolean;
  setAuthLoading: (authLoading: boolean) => void;
  setChatLoading: (chatLoading: boolean) => void;
}

export const useLoadingStore = create<LoadingState>((set) => ({
  authLoading: true,
  chatLoading: false,
  setAuthLoading: (authLoading) => set({ authLoading }),
  setChatLoading: (chatLoading) => set({ chatLoading }),
}));
