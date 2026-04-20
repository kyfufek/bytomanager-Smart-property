-- Add optional phone field to user profiles.
-- Safe to run repeatedly.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone text;
