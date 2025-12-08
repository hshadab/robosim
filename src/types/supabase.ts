/**
 * Supabase Database Types
 *
 * These types match the database schema in Supabase.
 * Run the SQL in supabase-schema.sql to create the tables.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      user_profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          avatar_url: string | null;
          tier: 'free' | 'pro' | 'team' | 'enterprise';
          tier_expires_at: string | null;
          usage_this_month: Json;
          settings: Json;
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          avatar_url?: string | null;
          tier?: 'free' | 'pro' | 'team' | 'enterprise';
          tier_expires_at?: string | null;
          usage_this_month?: Json;
          settings?: Json;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string | null;
          avatar_url?: string | null;
          tier?: 'free' | 'pro' | 'team' | 'enterprise';
          tier_expires_at?: string | null;
          usage_this_month?: Json;
          settings?: Json;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      usage_logs: {
        Row: {
          id: string;
          user_id: string;
          action: string;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          action: string;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          action?: string;
          metadata?: Json;
          created_at?: string;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      user_tier: 'free' | 'pro' | 'team' | 'enterprise';
    };
  };
}
