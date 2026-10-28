-- Founding Sales Workshop — artifacts_current must include the authors column
-- Run after 0002_collaboration.sql in the Supabase SQL editor.
--
-- 0001 created artifacts_current with "select *", and Postgres expands "*" when the view is
-- created, so the authors column added in 0002 is missing from it. Recreating the view picks
-- it up; without this, the Artifacts pages show a single author for shared-session versions.
drop view if exists artifacts_current;
create view artifacts_current as
  select distinct on (key) * from artifacts order by key, version desc;
