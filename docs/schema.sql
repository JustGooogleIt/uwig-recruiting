-- UWIG Recruiting: Supabase Postgres schema (production target).
-- Mirrors src/domain/types.ts. Shared directory tables are separate from owner-scoped recruiting tables.
-- Auth: Supabase Auth (auth.users). No passwords are stored in application tables.

create extension if not exists citext;

create type member_role as enum ('analyst', 'mentor', 'exec');
create type firm_status as enum ('approved', 'pending', 'merged', 'rejected');
create type activity_type as enum ('outreach','follow_up','reply','chat_scheduled','chat_completed','app_submitted','assessment_completed','interview_scheduled','interview_completed','offer','app_closed');
create type activity_source as enum ('manual','screenshot','csv');

-- ---------- Membership ----------
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  name text not null,
  email text not null unique,
  role member_role not null default 'analyst',        -- changed only by exec (see policy + trigger)
  class_year int,
  tracks text[] not null default '{}',
  timezone text not null default 'America/Los_Angeles',
  follow_up_days int not null default 7 check (follow_up_days between 1 and 30),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create table mentor_groups (id uuid primary key default gen_random_uuid(), name text not null, mentor_id uuid not null references profiles, created_at timestamptz not null default now());
create table group_assignments (
  analyst_id uuid primary key references profiles,      -- one group per analyst
  group_id uuid not null references mentor_groups on delete cascade,
  assigned_by uuid not null references profiles,
  assigned_at timestamptz not null default now()
);

-- ---------- Shared directory ----------
create table firms (
  id uuid primary key default gen_random_uuid(),
  name text not null, website text, firm_type text not null, careers_url text,
  status firm_status not null default 'pending',
  merged_into_id uuid references firms,
  submitted_by uuid references profiles,
  last_verified date,
  created_at timestamptz not null default now()
);
create unique index firms_name_approved on firms (lower(name)) where status = 'approved';
create table firm_aliases (firm_id uuid references firms on delete cascade, alias text not null, primary key (firm_id, alias));
create table firm_offices (firm_id uuid references firms on delete cascade, office text not null, primary key (firm_id, office));
create table firm_tracks (firm_id uuid references firms on delete cascade, track text not null, primary key (firm_id, track));
-- Exec-posted opportunities and club news (e.g. a firm reached out to the director of advancement).
create table announcements (
  id uuid primary key default gen_random_uuid(), author_id uuid not null references profiles default auth.uid(),
  title text not null, body text not null, firm_id uuid references firms,
  contact_name text, contact_email citext, link text, tracks text[] not null default '{}', deadline date,
  pinned boolean not null default false, archived boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

-- ---------- Personal recruiting (owner-scoped) ----------
create table targets (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references profiles default auth.uid(),
  firm_id uuid not null references firms, track text not null, cycle text not null, offices text[] not null default '{}',
  priority text not null check (priority in ('high','medium','low')), state text not null default 'active',
  created_at timestamptz not null default now(),
  unique (owner_id, firm_id, track, cycle)
);
create table contacts (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references profiles default auth.uid(),
  name text not null, firm_id uuid not null references firms, title text, seniority text, email citext, linkedin text, office text,
  source text not null, closed boolean not null default false, import_batch_id uuid,
  created_at timestamptz not null default now()
);
create unique index contacts_owner_email on contacts (owner_id, email) where email is not null;
create table applications (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references profiles default auth.uid(),
  firm_id uuid not null references firms,
  role_title text not null, track text not null, cycle text not null, office text, opp_type text not null, url text,
  deadline date, applied_on date, stage text not null, next_action text, next_action_due date,
  created_at timestamptz not null default now()
);
create table application_contacts (application_id uuid references applications on delete cascade, contact_id uuid references contacts on delete cascade, primary key (application_id, contact_id));
create table interview_events (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references profiles default auth.uid(),
  application_id uuid not null references applications on delete cascade, round text not null, interview_type text not null,
  scheduled_at timestamptz not null, status text not null default 'scheduled', created_at timestamptz not null default now()
);
create table import_batches (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references profiles default auth.uid(),
  source activity_source not null, status text not null check (status in ('review','confirmed','undone','expired')),
  created_at timestamptz not null default now(), confirmed_at timestamptz, undone_at timestamptz,
  expires_at timestamptz not null default now() + interval '24 hours'   -- abandoned uploads expire
);
create table import_rows (                                               -- pending extracted rows; never counted in analytics
  id uuid primary key default gen_random_uuid(), batch_id uuid not null references import_batches on delete cascade,
  row_key text not null, payload jsonb not null, include boolean not null default true,
  unique (batch_id, row_key)
);
create table activities (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references profiles default auth.uid(),
  type activity_type not null, occurred_at timestamptz not null, date_only boolean not null default false, event_at timestamptz,
  contact_id uuid references contacts on delete cascade, application_id uuid references applications on delete cascade,
  source activity_source not null default 'manual', import_batch_id uuid references import_batches, import_row_key text,
  created_at timestamptz not null default now(),
  check (contact_id is not null or application_id is not null)
);
-- Reconfirming the same extracted row can never create a second activity.
create unique index activities_import_row on activities (owner_id, import_row_key) where import_row_key is not null;
create table follow_up_tasks (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references profiles,
  contact_id uuid not null references contacts on delete cascade, due_on date not null,
  status text not null check (status in ('open','done','cancelled','resolved')),
  source_activity_id uuid not null references activities on delete cascade, resolved_by_activity_id uuid references activities on delete set null,
  snooze_count int not null default 0, created_at timestamptz not null default now(), closed_at timestamptz
);
create unique index one_open_follow_up on follow_up_tasks (contact_id) where status = 'open';

-- ---------- Coaching ----------
create table goals (
  id uuid primary key default gen_random_uuid(), analyst_id uuid not null references profiles, set_by uuid not null references profiles,
  goal_type text not null, target int not null check (target >= 1), label text, start_on date not null, due_on date not null check (due_on >= start_on),
  completed_at timestamptz, cancelled boolean not null default false, created_at timestamptz not null default now()
);
create table mentor_experience (
  member_id uuid primary key references profiles, tracks text[] not null, firms_interviewed text[] not null default '{}',
  interview_types text[] not null default '{}', recruiting_year int, firms_worked text[] not null default '{}',
  availability text not null default 'Available', scheduling_url text
);
create table mock_requests (
  id uuid primary key default gen_random_uuid(), mentor_id uuid not null references profiles, requester_id uuid not null references profiles default auth.uid(),
  track text not null, interview_type text not null, target_firm_id uuid references firms, proposed_time timestamptz, scheduling_link text,
  scheduled_at timestamptz, completed_at timestamptz, status text not null default 'Requested',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check (mentor_id <> requester_id)
);

-- ---------- Authorization helpers ----------
create function is_exec() returns boolean language sql stable security definer as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'exec' and active) $$;
create function mentors_analyst(analyst uuid) returns boolean language sql stable security definer as $$
  select exists (select 1 from group_assignments ga join mentor_groups g on g.id = ga.group_id
                 where ga.analyst_id = analyst and g.mentor_id = auth.uid()) $$;
create function can_view_workspace(owner uuid) returns boolean language sql stable as $$
  select owner = auth.uid() or is_exec() or mentors_analyst(owner) $$;

-- ---------- Row-level security ----------
alter table profiles enable row level security;
alter table announcements enable row level security;
alter table targets enable row level security;
alter table contacts enable row level security;
alter table applications enable row level security;
alter table interview_events enable row level security;
alter table activities enable row level security;
alter table follow_up_tasks enable row level security;
alter table import_batches enable row level security;
alter table import_rows enable row level security;
alter table goals enable row level security;
alter table firms enable row level security;
alter table mock_requests enable row level security;
alter table group_assignments enable row level security;

-- Personal records: read by owner, assigned mentor, exec. Written only by owner.
create policy read_ws on contacts for select using (can_view_workspace(owner_id));
create policy write_own on contacts for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy read_ws on applications for select using (can_view_workspace(owner_id));
create policy write_own on applications for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy read_ws on activities for select using (can_view_workspace(owner_id));
create policy write_own on activities for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy read_ws on targets for select using (can_view_workspace(owner_id));
create policy write_own on targets for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy read_ws on interview_events for select using (can_view_workspace(owner_id));
create policy write_own on interview_events for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy read_ws on follow_up_tasks for select using (can_view_workspace(owner_id));
create policy write_own on follow_up_tasks for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
-- Imports are private to their owner (mentors/exec see confirmed activities, not raw uploads).
create policy own_only on import_batches for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy own_only on import_rows for all using (exists (select 1 from import_batches b where b.id = batch_id and b.owner_id = auth.uid()));
-- Goals: analyst reads own; assigned mentor and exec manage.
create policy read_goals on goals for select using (can_view_workspace(analyst_id));
create policy manage_goals on goals for all using (is_exec() or mentors_analyst(analyst_id)) with check (is_exec() or mentors_analyst(analyst_id));
-- Directory: approved firms readable by all members; pending visible to submitter and exec; only exec approves/merges.
create policy read_firms on firms for select using (status = 'approved' or submitted_by = auth.uid() or is_exec());
create policy submit_firm on firms for insert with check (status = 'pending' and submitted_by = auth.uid());
create policy exec_firms on firms for update using (is_exec());
create policy exec_add_firms on firms for insert with check (is_exec());
alter table firms add column source text; -- e.g. 'Exec firm list'
create policy read_announcements on announcements for select using (auth.uid() is not null and (not archived or is_exec()));
create policy exec_announcements on announcements for all using (is_exec()) with check (is_exec());
-- Mock requests: visible only to the two parties. No workspace access is implied.
create policy mock_parties on mock_requests for select using (auth.uid() in (mentor_id, requester_id));
create policy mock_create on mock_requests for insert with check (requester_id = auth.uid());
create policy mock_update on mock_requests for update using (auth.uid() in (mentor_id, requester_id));
-- Membership: everyone reads profiles (names for mentor browsing); only exec changes role/active/assignments.
create policy read_profiles on profiles for select using (auth.uid() is not null);
create policy self_prefs on profiles for update using (id = auth.uid());
create policy exec_profiles on profiles for update using (is_exec());
create policy read_assign on group_assignments for select using (auth.uid() is not null);
create policy exec_assign on group_assignments for all using (is_exec()) with check (is_exec());
-- Members cannot elevate themselves: block role/active changes unless caller is exec and not self.
create function guard_role_change() returns trigger language plpgsql as $$
begin
  if (new.role <> old.role or new.active <> old.active) and (not is_exec() or new.id = auth.uid()) then
    raise exception 'Only exec can change roles or membership status, and not their own.';
  end if;
  return new;
end $$;
create trigger profiles_role_guard before update on profiles for each row execute function guard_role_change();

-- Storage: bucket "screenshots" is private. Object path = '<owner uid>/<batch id>/<file>'.
-- Policy: storage.objects select/insert/delete only where (storage.foldername(name))[1] = auth.uid()::text.
-- A scheduled job deletes objects for confirmed batches and for batches past expires_at.
