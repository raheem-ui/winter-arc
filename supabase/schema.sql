-- Winter Arc Tracker schema. Paste into Supabase → SQL Editor → Run.
-- Every table is protected by Row Level Security: users only see their own rows.

create table if not exists public.profiles (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  settings   jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.daily_logs (
  user_id     uuid not null references auth.users (id) on delete cascade,
  date        date not null,
  college     text check (college in ('Y', 'N', 'Off')),
  internship  text check (internship in ('Y', 'N')),
  gym         text check (gym in ('Y', 'N', 'Rest')),
  diet        text check (diet in ('Y', 'N')),
  assignments text check (assignments in ('Y', 'N')),
  skill_min   integer check (skill_min between 0 and 600),
  bedtime     text,
  wake        text,
  weight      numeric(5, 1) check (weight between 20 and 300),
  notes       text,
  updated_at  timestamptz not null default now(),
  primary key (user_id, date)
);

create table if not exists public.assignments (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  subject    text not null default '',
  title      text not null default '',
  given_on   date,
  due_date   date,
  status     text not null default 'Not started' check (status in ('Not started', 'In progress', 'Submitted')),
  notes      text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists assignments_user_due on public.assignments (user_id, due_date);

create table if not exists public.weekly_reviews (
  user_id uuid not null references auth.users (id) on delete cascade,
  week    integer not null,
  win     text,
  fix     text,
  primary key (user_id, week)
);

alter table public.profiles       enable row level security;
alter table public.daily_logs     enable row level security;
alter table public.assignments    enable row level security;
alter table public.weekly_reviews enable row level security;

do $$
declare t text;
begin
  foreach t in array array['profiles', 'daily_logs', 'assignments', 'weekly_reviews'] loop
    execute format('drop policy if exists "own rows" on public.%I', t);
    execute format(
      'create policy "own rows" on public.%I for all to authenticated
         using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
  end loop;
end $$;
