-- Stone Tracker: Supabase schema
-- Run this once in the Supabase SQL editor (Project > SQL Editor > New query).

create table if not exists projects (
  id text primary key,
  name text not null,
  client text,
  "startDate" date,
  deadline date,
  status text
);

create table if not exists tasks (
  id text primary key,
  "projectId" text references projects(id) on delete cascade,
  "taskName" text,
  description text,
  assignee text[],
  "taskOwner" text[],
  priority text,
  status text,
  "startDate" date,
  "dueDate" date,
  notes text
);

create table if not exists users (
  id text primary key,
  username text unique not null,
  "passwordHash" text not null,
  email text,
  role text default 'task_assignee',
  "createdAt" timestamptz default now(),
  "resetTokenHash" text,
  "resetTokenExpiry" timestamptz
);

-- If you already ran an earlier version of this schema, add the new columns:
-- alter table users add column if not exists email text;
-- alter table users add column if not exists "resetTokenHash" text;
-- alter table users add column if not exists "resetTokenExpiry" timestamptz;

-- Multi-assign migration: if your tasks.assignee / tasks."taskOwner" columns
-- are still plain `text` (single person per task) from an earlier version of
-- this schema, run this once to upgrade them to `text[]` (multiple people per
-- task), preserving each existing single value as a one-person array:
-- alter table tasks alter column assignee type text[] using
--   case when assignee is null or assignee = '' then '{}'::text[] else array[assignee] end;
-- alter table tasks alter column "taskOwner" type text[] using
--   case when "taskOwner" is null or "taskOwner" = '' then '{}'::text[] else array["taskOwner"] end;

-- Row Level Security: the backend talks to Supabase using the service_role
-- key (server-side only), which bypasses RLS, so these tables are safe to
-- lock down from any other (anon/public) access.
alter table projects enable row level security;
alter table tasks enable row level security;
alter table users enable row level security;
