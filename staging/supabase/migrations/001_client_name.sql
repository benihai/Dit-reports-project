-- Migration 001: add client_name to projects
-- Run once in Supabase Dashboard → SQL Editor

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'projects'
      AND column_name  = 'client_name'
  ) THEN
    ALTER TABLE public.projects ADD COLUMN client_name text;
  END IF;
END $$;

-- Migration 002: add note_number to notes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'notes'
      AND column_name  = 'note_number'
  ) THEN
    ALTER TABLE public.notes ADD COLUMN note_number integer;
  END IF;
END $$;
