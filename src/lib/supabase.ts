/**
 * Supabase Client Configuration
 *
 * This file initializes the Supabase client for authentication and database access.
 *
 * Setup Instructions:
 * 1. Create a Supabase project at https://supabase.com
 * 2. Go to Project Settings > API
 * 3. Copy your Project URL and anon/public key
 * 4. Create a .env file with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
 *
 * For Google OAuth:
 * 1. Go to Authentication > Providers > Google
 * 2. Enable Google provider
 * 3. Add your Google OAuth credentials (from Google Cloud Console)
 * 4. Add your site URL to the redirect URLs
 */

import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/supabase';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Check if Supabase is configured
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

// Create a mock client for development without Supabase
const mockClient = {
  auth: {
    getSession: async () => ({ data: { session: null }, error: null }),
    getUser: async () => ({ data: { user: null }, error: null }),
    signInWithOAuth: async () => ({ data: {}, error: new Error('Supabase not configured') }),
    signInWithPassword: async () => ({ data: {}, error: new Error('Supabase not configured') }),
    signUp: async () => ({ data: {}, error: new Error('Supabase not configured') }),
    signOut: async () => ({ error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    resetPasswordForEmail: async () => ({ data: {}, error: null }),
  },
  from: () => ({
    select: () => ({ single: async () => ({ data: null, error: null }), eq: () => ({ single: async () => ({ data: null, error: null }) }) }),
    insert: async () => ({ data: null, error: null }),
    update: async () => ({ data: null, error: null }),
    upsert: async () => ({ data: null, error: null }),
  }),
};

// Create the Supabase client or use mock
export const supabase = isSupabaseConfigured
  ? createClient<Database>(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    })
  : (mockClient as unknown as ReturnType<typeof createClient<Database>>);

// Auth helper functions
export async function signInWithGoogle() {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase is not configured. Please add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file.');
  }

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/`,
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
    },
  });

  if (error) throw error;
  return data;
}

export async function signInWithGitHub() {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase is not configured.');
  }

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'github',
    options: {
      redirectTo: `${window.location.origin}/`,
    },
  });

  if (error) throw error;
  return data;
}

export async function signInWithEmail(email: string, password: string) {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase is not configured.');
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw error;
  return data;
}

export async function signUpWithEmail(email: string, password: string, name?: string) {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase is not configured.');
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: name,
      },
    },
  });

  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function resetPassword(email: string) {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase is not configured.');
  }

  const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });

  if (error) throw error;
  return data;
}

// User profile helpers
export type UserTier = 'free' | 'pro' | 'team' | 'enterprise';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  tier: UserTier;
  tier_expires_at: string | null;
  usage_this_month: {
    episodes_exported: number;
    api_calls: number;
    storage_mb: number;
  };
  settings: {
    theme: 'light' | 'dark' | 'system';
    notifications_enabled: boolean;
  };
  created_at: string;
  updated_at: string;
}

export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  if (!isSupabaseConfigured) return null;

  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) {
    console.error('Error fetching user profile:', error);
    return null;
  }

  return data as UserProfile;
}

export async function updateUserProfile(userId: string, updates: Partial<UserProfile>) {
  if (!isSupabaseConfigured) return null;

  // Convert to database-compatible format
  const dbUpdates = {
    ...updates,
    updated_at: new Date().toISOString(),
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const query = supabase.from('user_profiles') as any;
  const { data, error } = await query
    .update(dbUpdates)
    .eq('id', userId)
    .select()
    .single();

  if (error) throw error;
  return data as UserProfile;
}

// Tier limits
export const TIER_LIMITS = {
  free: {
    episodes_per_month: 10,
    max_episode_length: 100, // frames
    export_formats: ['json'],
    robots: ['so-101'],
    api_calls_per_day: 50,
    storage_mb: 100,
    features: {
      basic_simulation: true,
      dataset_export: true,
      huggingface_upload: false,
      ai_chat: false,
      image_to_3d: false,
      policy_inference: false,
      multi_robot: false,
      custom_environments: false,
    },
  },
  pro: {
    episodes_per_month: 500,
    max_episode_length: 1000,
    export_formats: ['json', 'parquet', 'lerobot'],
    robots: ['so-101', 'elegoo-smart-car-v4', 'mini-quadcopter'],
    api_calls_per_day: 1000,
    storage_mb: 5000,
    features: {
      basic_simulation: true,
      dataset_export: true,
      huggingface_upload: true,
      ai_chat: true,
      image_to_3d: true,
      policy_inference: true,
      multi_robot: false,
      custom_environments: true,
    },
  },
  team: {
    episodes_per_month: 5000,
    max_episode_length: 5000,
    export_formats: ['json', 'parquet', 'lerobot', 'ros'],
    robots: ['so-101', 'elegoo-smart-car-v4', 'mini-quadcopter', 'berkeley-humanoid-lite'],
    api_calls_per_day: 10000,
    storage_mb: 50000,
    features: {
      basic_simulation: true,
      dataset_export: true,
      huggingface_upload: true,
      ai_chat: true,
      image_to_3d: true,
      policy_inference: true,
      multi_robot: true,
      custom_environments: true,
    },
  },
  enterprise: {
    episodes_per_month: -1, // unlimited
    max_episode_length: -1,
    export_formats: ['json', 'parquet', 'lerobot', 'ros', 'custom'],
    robots: ['all'],
    api_calls_per_day: -1,
    storage_mb: -1,
    features: {
      basic_simulation: true,
      dataset_export: true,
      huggingface_upload: true,
      ai_chat: true,
      image_to_3d: true,
      policy_inference: true,
      multi_robot: true,
      custom_environments: true,
    },
  },
} as const;

export function checkFeatureAccess(tier: UserTier, feature: keyof typeof TIER_LIMITS.free.features): boolean {
  return TIER_LIMITS[tier].features[feature];
}

export function checkUsageLimit(tier: UserTier, usage: number, limitType: 'episodes_per_month' | 'api_calls_per_day'): boolean {
  const limit = TIER_LIMITS[tier][limitType];
  return limit === -1 || usage < limit;
}
