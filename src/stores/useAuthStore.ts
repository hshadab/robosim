/**
 * Authentication Store with Supabase
 *
 * Handles user authentication state, profile data, and tier management.
 * Falls back to mock auth when Supabase is not configured (development).
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, Session } from '@supabase/supabase-js';
import {
  supabase,
  isSupabaseConfigured,
  signInWithGoogle,
  signInWithGitHub,
  signInWithEmail,
  signUpWithEmail,
  signOut as supabaseSignOut,
  getUserProfile,
  type UserProfile,
  type UserTier,
  TIER_LIMITS,
  checkFeatureAccess,
} from '../lib/supabase';

interface AuthState {
  // Auth state
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // Auth actions
  initialize: () => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  loginWithGitHub: () => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => Promise<void>;

  // Mock login for development
  mockLogin: (email: string) => Promise<boolean>;

  // Convenience login (uses mock in dev, shows login modal in prod)
  login: (email: string) => Promise<boolean>;

  // Profile actions
  refreshProfile: () => Promise<void>;

  // Tier helpers
  getTier: () => UserTier;
  canAccessFeature: (feature: keyof typeof TIER_LIMITS.free.features) => boolean;
  isWithinUsageLimit: (limitType: 'episodes_per_month' | 'api_calls_per_day') => boolean;

  // Clear error
  clearError: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      session: null,
      profile: null,
      isAuthenticated: false,
      isLoading: true,
      error: null,

      initialize: async () => {
        if (!isSupabaseConfigured) {
          // Development mode without Supabase
          set({ isLoading: false });
          return;
        }

        try {
          // Get current session
          const { data: { session }, error } = await supabase.auth.getSession();

          if (error) throw error;

          if (session?.user) {
            const profile = await getUserProfile(session.user.id);
            set({
              user: session.user,
              session,
              profile,
              isAuthenticated: true,
              isLoading: false,
            });
          } else {
            set({ isLoading: false });
          }

          // Listen for auth changes
          supabase.auth.onAuthStateChange(async (event, session) => {
            if (event === 'SIGNED_IN' && session?.user) {
              const profile = await getUserProfile(session.user.id);
              set({
                user: session.user,
                session,
                profile,
                isAuthenticated: true,
              });
            } else if (event === 'SIGNED_OUT') {
              set({
                user: null,
                session: null,
                profile: null,
                isAuthenticated: false,
              });
            }
          });
        } catch (error) {
          console.error('Auth initialization error:', error);
          set({ isLoading: false, error: 'Failed to initialize authentication' });
        }
      },

      loginWithGoogle: async () => {
        set({ isLoading: true, error: null });
        try {
          await signInWithGoogle();
          // Redirect happens automatically, state updates via onAuthStateChange
        } catch (error) {
          set({
            isLoading: false,
            error: error instanceof Error ? error.message : 'Google login failed',
          });
        }
      },

      loginWithGitHub: async () => {
        set({ isLoading: true, error: null });
        try {
          await signInWithGitHub();
        } catch (error) {
          set({
            isLoading: false,
            error: error instanceof Error ? error.message : 'GitHub login failed',
          });
        }
      },

      loginWithEmail: async (email: string, password: string) => {
        set({ isLoading: true, error: null });
        try {
          const { user, session } = await signInWithEmail(email, password);
          if (user) {
            const profile = await getUserProfile(user.id);
            set({
              user,
              session,
              profile,
              isAuthenticated: true,
              isLoading: false,
            });
          }
        } catch (error) {
          set({
            isLoading: false,
            error: error instanceof Error ? error.message : 'Email login failed',
          });
        }
      },

      signUpWithEmail: async (email: string, password: string, name?: string) => {
        set({ isLoading: true, error: null });
        try {
          const { user } = await signUpWithEmail(email, password, name);
          if (user) {
            set({
              isLoading: false,
              error: null,
            });
            // User needs to verify email before being fully logged in
          }
        } catch (error) {
          set({
            isLoading: false,
            error: error instanceof Error ? error.message : 'Sign up failed',
          });
        }
      },

      logout: async () => {
        set({ isLoading: true });
        try {
          if (isSupabaseConfigured) {
            await supabaseSignOut();
          }
          set({
            user: null,
            session: null,
            profile: null,
            isAuthenticated: false,
            isLoading: false,
          });
          // Clear persisted state
          localStorage.removeItem('robosim-auth');
        } catch (error) {
          set({
            isLoading: false,
            error: error instanceof Error ? error.message : 'Logout failed',
          });
        }
      },

      // Mock login for development without Supabase
      mockLogin: async (email: string) => {
        set({ isLoading: true, error: null });
        await new Promise((resolve) => setTimeout(resolve, 500));

        const mockUser = {
          id: 'mock-user-id',
          email,
          user_metadata: { full_name: email.split('@')[0] },
        } as unknown as User;

        const mockProfile: UserProfile = {
          id: 'mock-user-id',
          email,
          full_name: email.split('@')[0],
          avatar_url: null,
          tier: 'free',
          tier_expires_at: null,
          usage_this_month: {
            episodes_exported: 0,
            api_calls: 0,
            storage_mb: 0,
          },
          settings: {
            theme: 'system',
            notifications_enabled: true,
          },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        set({
          user: mockUser,
          profile: mockProfile,
          isAuthenticated: true,
          isLoading: false,
        });

        return true;
      },

      // Convenience login function - uses mockLogin for quick access
      login: async (email: string) => {
        return get().mockLogin(email);
      },

      refreshProfile: async () => {
        const { user } = get();
        if (!user || !isSupabaseConfigured) return;

        try {
          const profile = await getUserProfile(user.id);
          set({ profile });
        } catch (error) {
          console.error('Failed to refresh profile:', error);
        }
      },

      getTier: () => {
        const { profile } = get();
        return profile?.tier || 'free';
      },

      canAccessFeature: (feature) => {
        const tier = get().getTier();
        return checkFeatureAccess(tier, feature);
      },

      isWithinUsageLimit: (limitType) => {
        const { profile } = get();
        const tier = get().getTier();
        const limit = TIER_LIMITS[tier][limitType];

        if (limit === -1) return true; // Unlimited

        const currentUsage = limitType === 'episodes_per_month'
          ? profile?.usage_this_month?.episodes_exported || 0
          : profile?.usage_this_month?.api_calls || 0;

        return currentUsage < limit;
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'robosim-auth',
      partialize: (state) => ({
        // Only persist minimal state - real auth state comes from Supabase
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

// Initialize auth on app load
if (typeof window !== 'undefined') {
  useAuthStore.getState().initialize();
}
