-- Migration 004: allow users to create their own profile on first login
-- Run once in Supabase → SQL Editor

DROP POLICY IF EXISTS "profiles: users can insert own" ON public.profiles;
CREATE POLICY "profiles: users can insert own"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (
    id = auth.uid()
    AND role IN ('user', 'viewer')
  );
