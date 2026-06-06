-- Migration 003: per-user folder (person) assignment
-- Run once in Supabase Dashboard → SQL Editor

-- ── profiles: email + assigned folder ───────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'email'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN email text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'person_id'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN person_id text REFERENCES public.people(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Allow role 'user' (folder-scoped) in addition to admin / viewer
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'user', 'viewer'));

-- ── helpers ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.assigned_person_id()
RETURNS text LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT person_id FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.has_folder_access(p_person_id text)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT public.is_admin()
    OR (
      p_person_id IS NOT NULL
      AND p_person_id = (SELECT person_id FROM public.profiles WHERE id = auth.uid())
    );
$$;

-- ── auto-create profile (default role: user) ────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles(id, name, role, person_id, email)
  VALUES(
    new.id,
    coalesce(new.raw_user_meta_data->>'name', ''),
    coalesce(new.raw_user_meta_data->>'role', 'user'),
    nullif(new.raw_user_meta_data->>'person_id', ''),
    new.email
  );
  RETURN new;
END;
$$;

-- ── admins may update any profile ───────────────────────────
DROP POLICY IF EXISTS "profiles: admins can update any" ON public.profiles;
CREATE POLICY "profiles: admins can update any"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ── PEOPLE: folder-scoped users ─────────────────────────────
DROP POLICY IF EXISTS "people: users select own folder" ON public.people;
CREATE POLICY "people: users select own folder"
  ON public.people FOR SELECT
  TO authenticated
  USING (public.has_folder_access(id));

-- ── PROJECTS: folder-scoped users ───────────────────────────
DROP POLICY IF EXISTS "projects: users select own" ON public.projects;
CREATE POLICY "projects: users select own"
  ON public.projects FOR SELECT TO authenticated
  USING (public.has_folder_access(person_id));

DROP POLICY IF EXISTS "projects: users insert own" ON public.projects;
CREATE POLICY "projects: users insert own"
  ON public.projects FOR INSERT TO authenticated
  WITH CHECK (public.has_folder_access(person_id));

DROP POLICY IF EXISTS "projects: users update own" ON public.projects;
CREATE POLICY "projects: users update own"
  ON public.projects FOR UPDATE TO authenticated
  USING (public.has_folder_access(person_id))
  WITH CHECK (public.has_folder_access(person_id));

DROP POLICY IF EXISTS "projects: users delete own" ON public.projects;
CREATE POLICY "projects: users delete own"
  ON public.projects FOR DELETE TO authenticated
  USING (public.has_folder_access(person_id));

-- ── REPORTS: folder-scoped users ────────────────────────────
DROP POLICY IF EXISTS "reports: users select own folder" ON public.reports;
CREATE POLICY "reports: users select own folder"
  ON public.reports FOR SELECT TO authenticated
  USING (
    NOT public.is_admin()
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id AND public.has_folder_access(p.person_id)
    )
  );

DROP POLICY IF EXISTS "reports: users insert own folder" ON public.reports;
CREATE POLICY "reports: users insert own folder"
  ON public.reports FOR INSERT TO authenticated
  WITH CHECK (
    NOT public.is_admin()
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id AND public.has_folder_access(p.person_id)
    )
  );

DROP POLICY IF EXISTS "reports: users update own folder" ON public.reports;
CREATE POLICY "reports: users update own folder"
  ON public.reports FOR UPDATE TO authenticated
  USING (
    NOT public.is_admin()
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id AND public.has_folder_access(p.person_id)
    )
  )
  WITH CHECK (
    NOT public.is_admin()
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id AND public.has_folder_access(p.person_id)
    )
  );

DROP POLICY IF EXISTS "reports: users delete own folder" ON public.reports;
CREATE POLICY "reports: users delete own folder"
  ON public.reports FOR DELETE TO authenticated
  USING (
    NOT public.is_admin()
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id AND public.has_folder_access(p.person_id)
    )
  );

-- ── NOTES: folder-scoped users ──────────────────────────────
DROP POLICY IF EXISTS "notes: users select own folder" ON public.notes;
CREATE POLICY "notes: users select own folder"
  ON public.notes FOR SELECT TO authenticated
  USING (
    NOT public.is_admin()
    AND EXISTS (
      SELECT 1 FROM public.reports r
        JOIN public.projects p ON p.id = r.project_id
      WHERE r.id = notes.report_id AND public.has_folder_access(p.person_id)
    )
  );

DROP POLICY IF EXISTS "notes: users insert own folder" ON public.notes;
CREATE POLICY "notes: users insert own folder"
  ON public.notes FOR INSERT TO authenticated
  WITH CHECK (
    NOT public.is_admin()
    AND EXISTS (
      SELECT 1 FROM public.reports r
        JOIN public.projects p ON p.id = r.project_id
      WHERE r.id = report_id AND public.has_folder_access(p.person_id)
    )
  );

DROP POLICY IF EXISTS "notes: users update own folder" ON public.notes;
CREATE POLICY "notes: users update own folder"
  ON public.notes FOR UPDATE TO authenticated
  USING (
    NOT public.is_admin()
    AND EXISTS (
      SELECT 1 FROM public.reports r
        JOIN public.projects p ON p.id = r.project_id
      WHERE r.id = notes.report_id AND public.has_folder_access(p.person_id)
    )
  )
  WITH CHECK (
    NOT public.is_admin()
    AND EXISTS (
      SELECT 1 FROM public.reports r
        JOIN public.projects p ON p.id = r.project_id
      WHERE r.id = report_id AND public.has_folder_access(p.person_id)
    )
  );

DROP POLICY IF EXISTS "notes: users delete own folder" ON public.notes;
CREATE POLICY "notes: users delete own folder"
  ON public.notes FOR DELETE TO authenticated
  USING (
    NOT public.is_admin()
    AND EXISTS (
      SELECT 1 FROM public.reports r
        JOIN public.projects p ON p.id = r.project_id
      WHERE r.id = notes.report_id AND public.has_folder_access(p.person_id)
    )
  );

-- ── PLANS: folder-scoped users ──────────────────────────────
DROP POLICY IF EXISTS "plans: users select own folder" ON public.plans;
CREATE POLICY "plans: users select own folder"
  ON public.plans FOR SELECT TO authenticated
  USING (
    NOT public.is_admin()
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id AND public.has_folder_access(p.person_id)
    )
  );

DROP POLICY IF EXISTS "plans: users insert own folder" ON public.plans;
CREATE POLICY "plans: users insert own folder"
  ON public.plans FOR INSERT TO authenticated
  WITH CHECK (
    NOT public.is_admin()
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id AND public.has_folder_access(p.person_id)
    )
  );

DROP POLICY IF EXISTS "plans: users update own folder" ON public.plans;
CREATE POLICY "plans: users update own folder"
  ON public.plans FOR UPDATE TO authenticated
  USING (
    NOT public.is_admin()
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id AND public.has_folder_access(p.person_id)
    )
  )
  WITH CHECK (
    NOT public.is_admin()
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id AND public.has_folder_access(p.person_id)
    )
  );

DROP POLICY IF EXISTS "plans: users delete own folder" ON public.plans;
CREATE POLICY "plans: users delete own folder"
  ON public.plans FOR DELETE TO authenticated
  USING (
    NOT public.is_admin()
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id AND public.has_folder_access(p.person_id)
    )
  );
