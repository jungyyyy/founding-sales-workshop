-- Founding Sales Workshop — collaboration features
-- Run after 0001_init.sql in the Supabase SQL editor.

-- ---------- shared build sessions ----------
-- A shared session is one chat with the coach that both founders join. Each user turn is
-- stored with the speaker's name, so the coach can address whoever typed.
alter table build_sessions add column if not exists shared       boolean not null default false;
alter table build_sessions add column if not exists participants text[]  not null default '{}';
create index if not exists build_sessions_shared_open on build_sessions (module) where shared and status = 'open';

-- Artifacts written in a shared session list both founders as authors and are never drafts.
alter table artifacts add column if not exists authors text[];

-- ---------- pair drills ----------
-- mode = 'pair': one founder sells, the other plays the persona from a private buyer brief.
-- founder_slug stays "the seller being scored" (as in 0001); seller_slug duplicates it for clarity.
alter table drills add column if not exists seller_slug     text references founders(slug);
alter table drills add column if not exists participants    text[];
alter table drills add column if not exists briefs          jsonb;   -- { seller: markdown, buyer: markdown }
alter table drills add column if not exists transcript_text text;    -- pasted transcript of the live call
alter table drills add column if not exists transcript_link text;    -- e.g. a Wispr Flow share link, stored as text

-- Realtime: shared build sessions use broadcast + presence on public channels named
-- "build-<session id>". No table changes are needed for that; the anon key plus a logged-in
-- founder is enough. Nothing is published via postgres_changes.
