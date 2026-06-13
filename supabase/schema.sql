-- ============================================================
-- DIT Reports – Supabase Schema
-- ============================================================

-- ── PROFILES ────────────────────────────────────────────────
create table if not exists public.profiles (
  id         uuid primary key references auth.users on delete cascade,
  name       text,
  email      text,
  role       text not null default 'user' check (role in ('admin', 'user', 'viewer')),
  person_id  text,
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

alter table public.profiles drop constraint if exists profiles_person_id_fkey;
alter table public.profiles
  add constraint profiles_person_id_fkey
  foreign key (person_id) references public.people(id) on delete set null;

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
  responsibility_type text,
  tag          text,
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

create or replace function public.assigned_person_id()
returns text language sql security definer stable as $$
  select person_id from public.profiles where id = auth.uid();
$$;

create or replace function public.has_folder_access(p_person_id text)
returns boolean language sql security definer stable as $$
  select public.is_admin()
    or (
      p_person_id is not null
      and p_person_id = (select person_id from public.profiles where id = auth.uid())
    );
$$;

-- ============================================================
-- AUTO-CREATE PROFILE TRIGGER
-- ============================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles(id, name, role, person_id, email)
  values(
    new.id,
    coalesce(new.raw_user_meta_data->>'name', ''),
    coalesce(new.raw_user_meta_data->>'role', 'user'),
    nullif(new.raw_user_meta_data->>'person_id', ''),
    new.email
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

-- Admins can update any profile
create policy "profiles: admins can update any"
  on public.profiles for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Admins can insert profiles
create policy "profiles: admins can insert"
  on public.profiles for insert
  to authenticated
  with check (public.is_admin());

-- Users can create their own profile on first login (role user/viewer only)
create policy "profiles: users can insert own"
  on public.profiles for insert
  to authenticated
  with check (
    id = auth.uid()
    and role in ('user', 'viewer')
  );

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

-- ── Folder-scoped user policies (role=user with assigned person_id) ──
create policy "people: users select own folder"
  on public.people for select to authenticated
  using (public.has_folder_access(id));

create policy "projects: users select own"
  on public.projects for select to authenticated
  using (public.has_folder_access(person_id));
create policy "projects: users insert own"
  on public.projects for insert to authenticated
  with check (public.has_folder_access(person_id));
create policy "projects: users update own"
  on public.projects for update to authenticated
  using (public.has_folder_access(person_id))
  with check (public.has_folder_access(person_id));
create policy "projects: users delete own"
  on public.projects for delete to authenticated
  using (public.has_folder_access(person_id));

create policy "reports: users select own folder"
  on public.reports for select to authenticated
  using (not public.is_admin() and exists (
    select 1 from public.projects p where p.id = project_id and public.has_folder_access(p.person_id)
  ));
create policy "reports: users insert own folder"
  on public.reports for insert to authenticated
  with check (not public.is_admin() and exists (
    select 1 from public.projects p where p.id = project_id and public.has_folder_access(p.person_id)
  ));
create policy "reports: users update own folder"
  on public.reports for update to authenticated
  using (not public.is_admin() and exists (
    select 1 from public.projects p where p.id = project_id and public.has_folder_access(p.person_id)
  ))
  with check (not public.is_admin() and exists (
    select 1 from public.projects p where p.id = project_id and public.has_folder_access(p.person_id)
  ));
create policy "reports: users delete own folder"
  on public.reports for delete to authenticated
  using (not public.is_admin() and exists (
    select 1 from public.projects p where p.id = project_id and public.has_folder_access(p.person_id)
  ));

create policy "notes: users select own folder"
  on public.notes for select to authenticated
  using (not public.is_admin() and exists (
    select 1 from public.reports r join public.projects p on p.id = r.project_id
    where r.id = notes.report_id and public.has_folder_access(p.person_id)
  ));
create policy "notes: users insert own folder"
  on public.notes for insert to authenticated
  with check (not public.is_admin() and exists (
    select 1 from public.reports r join public.projects p on p.id = r.project_id
    where r.id = report_id and public.has_folder_access(p.person_id)
  ));
create policy "notes: users update own folder"
  on public.notes for update to authenticated
  using (not public.is_admin() and exists (
    select 1 from public.reports r join public.projects p on p.id = r.project_id
    where r.id = notes.report_id and public.has_folder_access(p.person_id)
  ))
  with check (not public.is_admin() and exists (
    select 1 from public.reports r join public.projects p on p.id = r.project_id
    where r.id = report_id and public.has_folder_access(p.person_id)
  ));
create policy "notes: users delete own folder"
  on public.notes for delete to authenticated
  using (not public.is_admin() and exists (
    select 1 from public.reports r join public.projects p on p.id = r.project_id
    where r.id = notes.report_id and public.has_folder_access(p.person_id)
  ));

create policy "plans: users select own folder"
  on public.plans for select to authenticated
  using (not public.is_admin() and exists (
    select 1 from public.projects p where p.id = project_id and public.has_folder_access(p.person_id)
  ));
create policy "plans: users insert own folder"
  on public.plans for insert to authenticated
  with check (not public.is_admin() and exists (
    select 1 from public.projects p where p.id = project_id and public.has_folder_access(p.person_id)
  ));
create policy "plans: users update own folder"
  on public.plans for update to authenticated
  using (not public.is_admin() and exists (
    select 1 from public.projects p where p.id = project_id and public.has_folder_access(p.person_id)
  ))
  with check (not public.is_admin() and exists (
    select 1 from public.projects p where p.id = project_id and public.has_folder_access(p.person_id)
  ));
create policy "plans: users delete own folder"
  on public.plans for delete to authenticated
  using (not public.is_admin() and exists (
    select 1 from public.projects p where p.id = project_id and public.has_folder_access(p.person_id)
  ));
