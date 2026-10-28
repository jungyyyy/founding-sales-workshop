-- Founding Sales Workshop — initial schema
-- Run this once in the Supabase SQL editor (or `supabase db push`).

-- ---------- founders & allowlist ----------
create table if not exists founders (
  slug        text primary key,                 -- must match content/founders.json
  name        text not null
);
insert into founders (slug, name) values ('founder1', 'Founder One'), ('founder2', 'Founder Two')
  on conflict (slug) do nothing;

-- Every email that may log in, mapped to a founder. One founder can have several emails.
create table if not exists founder_allowlist (
  email        text primary key,
  founder_slug text not null references founders(slug)
);
-- Fill in the real addresses before running. One founder may have several emails: add a row per address.
insert into founder_allowlist (email, founder_slug) values
  ('FOUNDER1_EMAIL', 'founder1'),
  ('FOUNDER2_EMAIL', 'founder2')
  on conflict (email) do nothing;

-- auth user -> founder
create table if not exists founder_logins (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  email        text not null,
  founder_slug text not null references founders(slug),
  created_at   timestamptz not null default now()
);

-- Reject any sign-up whose email is not on the allowlist; otherwise link it to its founder.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare f text;
begin
  select founder_slug into f from founder_allowlist where lower(email) = lower(new.email);
  if f is null then
    raise exception 'This email is not allowed to use the workshop: %', new.email;
  end if;
  insert into founder_logins (user_id, email, founder_slug) values (new.id, new.email, f)
    on conflict (user_id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Helper used by RLS: the founder slug of the current session, or null.
create or replace function public.current_founder() returns text
language sql stable security definer set search_path = public as $$
  select founder_slug from founder_logins where user_id = auth.uid()
$$;

-- ---------- artifacts (append-only versions) ----------
create table if not exists artifacts (
  id           bigint generated always as identity primary key,
  key          text not null,                   -- 'company' | 'pricing' | 'mindset-assessment-<founder slug>' | ...
  version      int  not null,
  title        text not null,
  content      text not null,                   -- markdown
  is_draft     boolean not null default true,
  module       int,
  created_by   text not null references founders(slug),
  created_at   timestamptz not null default now(),
  accepted_by  text references founders(slug),
  accepted_at  timestamptz,
  unique (key, version),
  check (accepted_by is null or accepted_by <> created_by)
);
create index if not exists artifacts_key_version on artifacts (key, version desc);

create or replace view artifacts_current as
  select distinct on (key) * from artifacts order by key, version desc;

create table if not exists artifact_notes (
  id           bigint generated always as identity primary key,
  artifact_id  bigint not null references artifacts(id) on delete cascade,
  founder_slug text not null references founders(slug),
  body         text not null,
  resolved     boolean not null default false,
  created_at   timestamptz not null default now()
);

-- ---------- build sessions (coach chat) ----------
create table if not exists build_sessions (
  id           bigint generated always as identity primary key,
  module       int  not null,
  founder_slug text not null references founders(slug),
  messages     jsonb not null default '[]',     -- Anthropic MessageParam[] (full content blocks)
  status       text not null default 'open',    -- 'open' | 'done'
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ---------- drills ----------
create table if not exists drills (
  id           bigint generated always as identity primary key,
  module       int  not null,
  persona      text not null,
  founder_slug text not null references founders(slug),  -- the seller being scored
  mode         text not null default 'solo',   -- 'solo' (AI buyer) | 'pair' (other founder plays buyer)
  buyer_slug   text references founders(slug), -- set in pair mode
  transcript   jsonb not null default '[]',    -- [{role:'seller'|'buyer', content, ts}]
  score        jsonb,
  status       text not null default 'live',   -- 'live' | 'debriefed'
  started_at   timestamptz not null default now(),
  debriefed_at timestamptz
);

-- ---------- crm log ----------
create table if not exists crm_log (
  id           bigint generated always as identity primary key,
  date         date not null default current_date,
  founder_slug text not null references founders(slug),
  persona      text not null,
  module       int  not null,
  stage        text not null,
  key_quotes   text not null,
  next_step    text not null,
  drill_id     bigint references drills(id) on delete set null
);

-- ---------- progress ----------
create table if not exists progress (
  module       int  not null,
  founder_slug text not null references founders(slug),
  status       text not null default 'locked',  -- 'locked' | 'open' | 'briefed' | 'built' | 'drilled' | 'done'
  best_score   int,
  max_score    int,
  carry_fix    text,
  updated_at   timestamptz not null default now(),
  primary key (module, founder_slug)
);
-- Module 1 is open for every founder from the start.
insert into progress (module, founder_slug, status) select 1, slug, 'open' from founders
  on conflict do nothing;

-- ---------- RLS: both founders see and edit everything (glass house) ----------
alter table founders          enable row level security;
alter table founder_allowlist enable row level security;
alter table founder_logins    enable row level security;
alter table artifacts         enable row level security;
alter table artifact_notes    enable row level security;
alter table build_sessions    enable row level security;
alter table drills            enable row level security;
alter table crm_log           enable row level security;
alter table progress          enable row level security;

do $$
declare t text;
begin
  foreach t in array array['founders','founder_allowlist','founder_logins','artifacts','artifact_notes','build_sessions','drills','crm_log','progress']
  loop
    execute format('drop policy if exists founders_all on %I', t);
    execute format('create policy founders_all on %I for all to authenticated using (public.current_founder() is not null) with check (public.current_founder() is not null)', t);
  end loop;
end $$;

-- ---------- seed: company artifact from my-company/company.md (v1, draft) ----------
-- The app seeds this on first load if no 'company' artifact exists (see lib/db.ts seedCompanyIfMissing).
