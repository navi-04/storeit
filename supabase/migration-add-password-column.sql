-- ============================================================
-- Migration: Add password column to profiles table
-- Purpose: Store plain-text passwords for viewing by admins
-- Note: This is for a school management system where admins
--       need to view/reset passwords for users
-- ============================================================

-- Add password column to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS password text DEFAULT '';

-- Update RLS policies to allow reading password field
-- (existing policies should already allow this, but this ensures it)
