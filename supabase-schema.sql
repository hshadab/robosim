-- Supabase Schema for RoboSim
-- Run this in your Supabase SQL Editor to set up the database

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enum for user tiers
CREATE TYPE user_tier AS ENUM ('free', 'pro', 'team', 'enterprise');

-- User profiles table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  tier user_tier DEFAULT 'free' NOT NULL,
  tier_expires_at TIMESTAMPTZ,
  usage_this_month JSONB DEFAULT '{"episodes_exported": 0, "api_calls": 0, "storage_mb": 0}'::jsonb,
  settings JSONB DEFAULT '{"theme": "system", "notifications_enabled": true}'::jsonb,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Usage logs for tracking API calls, exports, etc.
CREATE TABLE IF NOT EXISTS public.usage_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_usage_logs_user_id ON public.usage_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_logs_created_at ON public.usage_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON public.user_profiles(email);
CREATE INDEX IF NOT EXISTS idx_user_profiles_tier ON public.user_profiles(tier);

-- Enable Row Level Security
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_profiles
-- Users can only read their own profile
CREATE POLICY "Users can view own profile"
  ON public.user_profiles
  FOR SELECT
  USING (auth.uid() = id);

-- Users can update their own profile (but not tier - that's admin only)
CREATE POLICY "Users can update own profile"
  ON public.user_profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- RLS Policies for usage_logs
-- Users can view their own usage logs
CREATE POLICY "Users can view own usage logs"
  ON public.usage_logs
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own usage logs
CREATE POLICY "Users can insert own usage logs"
  ON public.usage_logs
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Function to automatically create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to reset monthly usage (run via cron job on 1st of each month)
CREATE OR REPLACE FUNCTION public.reset_monthly_usage()
RETURNS void AS $$
BEGIN
  UPDATE public.user_profiles
  SET usage_this_month = '{"episodes_exported": 0, "api_calls": 0, "storage_mb": 0}'::jsonb,
      updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to increment usage
CREATE OR REPLACE FUNCTION public.increment_usage(
  p_user_id UUID,
  p_field TEXT,
  p_amount INT DEFAULT 1
)
RETURNS void AS $$
BEGIN
  UPDATE public.user_profiles
  SET
    usage_this_month = jsonb_set(
      usage_this_month,
      ARRAY[p_field],
      to_jsonb(COALESCE((usage_this_month->>p_field)::int, 0) + p_amount)
    ),
    updated_at = NOW()
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant access to authenticated users
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, UPDATE ON public.user_profiles TO authenticated;
GRANT SELECT, INSERT ON public.usage_logs TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_usage TO authenticated;

-- Example: Give a user pro access (run manually or via Stripe webhook)
-- UPDATE public.user_profiles
-- SET tier = 'pro', tier_expires_at = NOW() + INTERVAL '1 month'
-- WHERE email = 'user@example.com';

-- Example: Check if user has exceeded free tier limits
-- SELECT
--   id,
--   email,
--   tier,
--   (usage_this_month->>'episodes_exported')::int as episodes,
--   CASE
--     WHEN tier = 'free' AND (usage_this_month->>'episodes_exported')::int >= 10 THEN true
--     ELSE false
--   END as limit_reached
-- FROM public.user_profiles;
