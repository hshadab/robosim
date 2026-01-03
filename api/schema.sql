-- RoboSim Shared Training Database Schema
-- Run this in your Supabase SQL editor to create the required tables

-- Shared examples table - stores successful pickup/manipulation examples
CREATE TABLE IF NOT EXISTS shared_examples (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    object_position JSONB NOT NULL,  -- [x, y, z] in meters
    object_type TEXT NOT NULL,       -- "cube", "cylinder", "ball"
    object_scale FLOAT NOT NULL,     -- Size in meters
    joint_sequence JSONB NOT NULL,   -- Array of joint angle objects
    ik_errors JSONB,                 -- { approach, grasp, lift } errors
    user_message TEXT,               -- Original command
    language_variants JSONB,         -- Alternative phrasings for training
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- Optional: track anonymous contributor (hashed)
    contributor_hash TEXT
);

-- Index for spatial queries (approximate nearest neighbor)
CREATE INDEX IF NOT EXISTS idx_shared_examples_object_type
    ON shared_examples(object_type);

CREATE INDEX IF NOT EXISTS idx_shared_examples_created_at
    ON shared_examples(created_at DESC);

-- For PostGIS spatial queries (optional, more efficient for large datasets)
-- CREATE EXTENSION IF NOT EXISTS postgis;
-- ALTER TABLE shared_examples ADD COLUMN position_point geometry(Point, 4326);
-- CREATE INDEX idx_position_point ON shared_examples USING GIST(position_point);

-- Training jobs table - tracks training runs
CREATE TABLE IF NOT EXISTS training_jobs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    job_id TEXT UNIQUE NOT NULL,
    status TEXT DEFAULT 'queued',    -- queued, running, completed, failed
    example_count INT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    model_url TEXT,                  -- HuggingFace model URL when done
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Row Level Security (RLS) - allow anyone to read, but not modify others' data
ALTER TABLE shared_examples ENABLE ROW LEVEL SECURITY;

-- Anyone can read examples (for querying similar pickups)
CREATE POLICY "Anyone can read examples" ON shared_examples
    FOR SELECT USING (true);

-- Anyone can insert examples (anonymous contributions)
CREATE POLICY "Anyone can insert examples" ON shared_examples
    FOR INSERT WITH CHECK (true);

-- Only service role can update/delete
CREATE POLICY "Service role can update" ON shared_examples
    FOR UPDATE USING (auth.role() = 'service_role');

CREATE POLICY "Service role can delete" ON shared_examples
    FOR DELETE USING (auth.role() = 'service_role');

-- Training jobs - read-only for users
ALTER TABLE training_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read jobs" ON training_jobs
    FOR SELECT USING (true);

CREATE POLICY "Service role manages jobs" ON training_jobs
    FOR ALL USING (auth.role() = 'service_role');
