/** biome-ignore-all assist/source/useSortedKeys: No Need */
import { create } from 'zustand';

type Mood = 'idle' | 'happy' | 'sad' | 'angry' | 'talking';

interface AvatarState {
  mood: Mood;
  isListening: boolean;
  isSpeaking: boolean;
  setMood: (mood: Mood) => void;
  setIsListening: (status: boolean) => void;
  setIsSpeaking: (status: boolean) => void;
  reset: () => void;
}

export const useAvatarStore = create<AvatarState>((set) => ({
  mood: 'idle',
  isListening: false,
  isSpeaking: false,
  setMood: (mood) => set({ mood }),
  setIsListening: (status) => set({ isListening: status }),
  setIsSpeaking: (status) => set({ isSpeaking: status }),
  reset: () => set({ mood: 'idle', isListening: false, isSpeaking: false }),
}));
