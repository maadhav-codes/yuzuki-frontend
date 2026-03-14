import type { Session, User } from '@supabase/supabase-js';
import { create } from 'zustand';
import { useLoadingStore } from '@/store/useLoadingStore';
import { useUserStore } from '@/store/useUserStore';
import { supabase } from '@/utils/supabase/client';

interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  setUser: (user: User | null) => void;
  setSession: (session: Session | null) => void;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: (redirectTo: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  initialize: () => () => void;
}

let refreshTimer: NodeJS.Timeout | null = null;

const startRefreshTimer = () => {
  if (refreshTimer) clearInterval(refreshTimer);
  refreshTimer = setInterval(
    async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) {
        await supabase.auth.refreshSession();
      }
    },
    30 * 60 * 1000
  ); // Check every 30 minutes
};

const stopRefreshTimer = () => {
  if (refreshTimer) clearInterval(refreshTimer);
};

export const useAuthStore = create<AuthState>((set, _) => ({
  initialize: () => {
    supabase.auth
      .getSession()
      .then(({ data: { session }, error }) => {
        if (error) {
          useLoadingStore.getState().setAuthLoading(false);
          useUserStore.getState().setUser(null);
          set({ loading: false, session: null, user: null });
          return;
        }

        useLoadingStore.getState().setAuthLoading(false);
        useUserStore.getState().setUser(session?.user ?? null);
        set({ loading: false, session, user: session?.user ?? null });
      })
      .catch(() => {
        useLoadingStore.getState().setAuthLoading(false);
        useUserStore.getState().setUser(null);
        set({ loading: false, session: null, user: null });
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        startRefreshTimer();
      } else {
        stopRefreshTimer();
      }
      useLoadingStore.getState().setAuthLoading(false);
      useUserStore.getState().setUser(session?.user ?? null);
      set({ loading: false, session, user: session?.user ?? null });
    });

    return () => {
      subscription.unsubscribe();
    };
  },
  loading: true,
  session: null,
  setSession: (session) => {
    useLoadingStore.getState().setAuthLoading(false);
    useUserStore.getState().setUser(session?.user ?? null);
    set({ loading: false, session, user: session?.user ?? null });
  },

  setUser: (user) => {
    useUserStore.getState().setUser(user);
    set({ user });
  },

  signIn: async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    // State update is handled by the onAuthStateChange listener
  },

  signInWithGoogle: async (redirectTo) => {
    const { error } = await supabase.auth.signInWithOAuth({
      options: { redirectTo },
      provider: 'google',
    });
    if (error) throw error;
  },

  signOut: async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    useUserStore.getState().setUser(null);
    set({ session: null, user: null });
  },

  signUp: async (email, password) => {
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
  },
  user: null,
}));
