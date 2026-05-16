-- ============================================================
-- DIT Reports – Supabase Schema
-- ============================================================

-- ── PROFILES ────────────────────────────────────────────────
create table if not exists public.profiles (
  id         uuid primary key references auth.users on delete cascade,
  name       text,
  role       text not null default 'admin' check (role in ('admin', 'viewer')),
  created_at timestamptz not null default now()
);

-- ── PEOPLE ──────────────────────────────────────────────────
create table if not exists public.people (
  id         text primary key,
  name       text not null,
  company    text,
  email      text,
  phone      text,
  logo_url   text,
  created_at bigint,
  created_by uuid references auth.users on delete set null
);

-- ── PROJECTS ────────────────────────────────────────────────
create table if not exists public.projects (
  id         text primary key,
  person_id  text references public.people on delete cascade,
  name       text not null,
  domain     text,
  logo_url   text,
  created_at bigint,
  created_by uuid references auth.users on delete set null
);

-- ── REPORTS ─────────────────────────────────────────────────
create table if not exists public.reports (
  id            text primary key,
  project_id    text references public.projects on delete cascade,
  report_number integer,
  site_name     text,
  description   text,
  date          text,
  inspector     text,
  participants  text,
  floors        text,
  summary       text,
  status        text not null default 'draft',
  created_at    bigint,
  created_by    uuid references auth.users on delete set null
);

-- ── NOTES ───────────────────────────────────────────────────
create table if not exists public.notes (
  id           text primary key,
  report_id    text references public.reports on delete cascade,
  floor        text,
  area         text,
  description  text,
  responsible  text,
  urgency      text,
  status       text,
  media_items  jsonb not null default '[]',
  plan_markups jsonb not null default '[]',
  created_at   bigint
);

-- ── PLANS ───────────────────────────────────────────────────
create table if not exists public.plans (
  id         text primary key,
  project_id text references public.projects on delete cascade,
  name       text,
  pdf_data   text,
  thumb_data text,
  created_at bigint
);

-- ── REPORT PERMISSIONS ──────────────────────────────────────
create table if not exists public.report_permissions (
  id        serial primary key,
  report_id text references public.reports on delete cascade,
  user_id   uuid references auth.users on delete cascade,
  unique (report_id, user_id)
);

-- ============================================================
-- HELPER: is_admin()
-- ============================================================
create or replace function public.is_admin()
returns boolean language sql security definer stable as $$
  select exists(select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- ============================================================
-- AUTO-CREATE PROFILE TRIGGER
-- ============================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles(id, name, role)
  values(
    new.id,
    coalesce(new.raw_user_meta_data->>'name', ''),
    coalesce(new.raw_user_meta_data->>'role', 'admin')
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table public.profiles           enable row level security;
alter table public.people             enable row level security;
alter table public.projects           enable row level security;
alter table public.reports            enable row level security;
alter table public.notes              enable row level security;
alter table public.plans              enable row level security;
alter table public.report_permissions enable row level security;

-- ── PROFILES policies ───────────────────────────────────────
-- Any authenticated user can read all profiles
create policy "profiles: authenticated can select"
  on public.profiles for select
  to authenticated
  using (true);

-- Users can update their own profile
create policy "profiles: users can update own"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Admins can insert profiles
create policy "profiles: admins can insert"
  on public.profiles for insert
  to authenticated
  with check (public.is_admin());

-- Admins can delete profiles
create policy "profiles: admins can delete"
  on public.profiles for delete
  to authenticated
  using (public.is_admin());

-- ── PEOPLE policies ─────────────────────────────────────────
create policy "people: admins select"
  on public.people for select
  to authenticated
  using (public.is_admin());

create policy "people: admins insert"
  on public.people for insert
  to authenticated
  with check (public.is_admin());

create policy "people: admins update"
  on public.people for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "people: admins delete"
  on public.people for delete
  to authenticated
  using (public.is_admin());

-- ── PROJECTS policies ───────────────────────────────────────
create policy "projects: admins select"
  on public.projects for select
  to authenticated
  using (public.is_admin());

create policy "projects: admins insert"
  on public.projects for insert
  to authenticated
  with check (public.is_admin());

create policy "projects: admins update"
  on public.projects for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "projects: admins delete"
  on public.projects for delete
  to authenticated
  using (public.is_admin());

-- ── REPORTS policies ────────────────────────────────────────
-- Admins have full CRUD
create policy "reports: admins select"
  on public.reports for select
  to authenticated
  using (public.is_admin());

create policy "reports: admins insert"
  on public.reports for insert
  to authenticated
  with check (public.is_admin());

create policy "reports: admins update"
  on public.reports for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "reports: admins delete"
  on public.reports for delete
  to authenticated
  using (public.is_admin());

-- Viewers can select reports they have permission for
create policy "reports: viewers select permitted"
  on public.reports for select
  to authenticated
  using (
    not public.is_admin()
    and exists (
      select 1 from public.report_permissions rp
      where rp.report_id = id
        and rp.user_id = auth.uid()
    )
  );

-- ── NOTES policies ──────────────────────────────────────────
create policy "notes: admins select"
  on public.notes for select
  to authenticated
  using (public.is_admin());

create policy "notes: admins insert"
  on public.notes for insert
  to authenticated
  with check (public.is_admin());

create policy "notes: admins update"
  on public.notes for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "notes: admins delete"
  on public.notes for delete
  to authenticated
  using (public.is_admin());

-- Viewers can select notes whose parent report they have permission for
create policy "notes: viewers select permitted"
  on public.notes for select
  to authenticated
  using (
    not public.is_admin()
    and exists (
      select 1 from public.report_permissions rp
      where rp.report_id = notes.report_id
        and rp.user_id = auth.uid()
    )
  );

-- ── PLANS policies ──────────────────────────────────────────
create policy "plans: admins select"
  on public.plans for select
  to authenticated
  using (public.is_admin());

create policy "plans: admins insert"
  on public.plans for insert
  to authenticated
  with check (public.is_admin());

create policy "plans: admins update"
  on public.plans for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "plans: admins delete"
  on public.plans for delete
  to authenticated
  using (public.is_admin());

-- Viewers can select plans if the related project has at least one report they can access
create policy "plans: viewers select permitted"
  on public.plans for select
  to authenticated
  using (
    not public.is_admin()
    and exists (
      select 1 from public.reports r
        join public.report_permissions rp on rp.report_id = r.id
      where r.project_id = plans.project_id
        and rp.user_id = auth.uid()
    )
  );

-- ── REPORT_PERMISSIONS policies ─────────────────────────────
create policy "report_permissions: admins select"
  on public.report_permissions for select
  to authenticated
  using (public.is_admin());

create policy "report_permissions: admins insert"
  on public.report_permissions for insert
  to authenticated
  with check (public.is_admin());

create policy "report_permissions: admins update"
  on public.report_permissions for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "report_permissions: admins delete"
  on public.report_permissions for delete
  to authenticated
  using (public.is_admin());

-- Viewers can see their own permission records
create policy "report_permissions: viewers select own"
  on public.report_permissions for select
  to authenticated
  using (
    not public.is_admin()
    and user_id = auth.uid()
  );
