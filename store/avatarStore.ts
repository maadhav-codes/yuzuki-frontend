import { create } from 'zustand';

export type Mood =
  | 'neutral'
  | 'happy'
  | 'sad'
  | 'angry'
  | 'surprised'
  | 'thinking'
  | 'idle'
  | 'talking';

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
  isListening: false,
  isSpeaking: false,
  mood: 'idle',
  reset: () => set({ isListening: false, isSpeaking: false, mood: 'idle' }),
  setIsListening: (status) => set({ isListening: status }),
  setIsSpeaking: (status) => set({ isSpeaking: status }),
  setMood: (mood) => set({ mood }),
}));
