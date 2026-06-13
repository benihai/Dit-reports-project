-- ============================================================
-- 007 — Multiple folders per user
-- A user (role='user') can now be assigned MORE THAN ONE folder
-- (person). Access is granted through the new junction table
-- profile_folders. profiles.person_id is kept as the "primary"
-- folder (first selected) for backward compatibility / default
-- landing, and is still honoured by has_folder_access().
-- ============================================================

-- ── Junction table: user → folders ──────────────────────────
create table if not exists public.profile_folders (
  user_id   uuid not null references auth.users  on delete cascade,
  person_id text not null references public.people on delete cascade,
  primary key (user_id, person_id)
);

create index if not exists profile_folders_user_idx   on public.profile_folders (user_id);
create index if not exists profile_folders_person_idx on public.profile_folders (person_id);

alter table public.profile_folders enable row level security;

-- ── Backfill: migrate existing single assignments ───────────
insert into public.profile_folders (user_id, person_id)
select id, person_id
from public.profiles
where person_id is not null
on conflict do nothing;

-- ── has_folder_access now checks the junction table ─────────
-- (plus the legacy profiles.person_id, so a user keeps access
--  even if their row was not backfilled for any reason).
create or replace function public.has_folder_access(p_person_id text)
returns boolean language sql security definer stable as $$
  select public.is_admin()
    or (
      p_person_id is not null
      and (
        exists (
          select 1 from public.profile_folders pf
          where pf.user_id = auth.uid()
            and pf.person_id = p_person_id
        )
        or p_person_id = (select person_id from public.profiles where id = auth.uid())
      )
    );
$$;

-- ── RLS for profile_folders ─────────────────────────────────
drop policy if exists "profile_folders: admins all"        on public.profile_folders;
create policy "profile_folders: admins all"
  on public.profile_folders for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "profile_folders: users select own"  on public.profile_folders;
create policy "profile_folders: users select own"
  on public.profile_folders for select
  to authenticated
  using (user_id = auth.uid());
