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
  assignee text,
  "taskOwner" text,
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
  role text default 'task_assignee',
  "createdAt" timestamptz default now()
);

-- Row Level Security: the backend talks to Supabase using the service_role
-- key (server-side only), which bypasses RLS, so these tables are safe to
-- lock down from any other (anon/public) access.
alter table projects enable row level security;
alter table tasks enable row level security;
alter table users enable row level security;
