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

create table if not exists invoices (
  id text primary key,
  "invoiceNumber" text,
  "clientName" text not null,
  "clientEmail" text,
  "clientAddress" text,
  "clientGstin" text,
  "issueDate" date,
  "dueDate" date,
  "lineItems" jsonb default '[]'::jsonb,
  "taxPercent" numeric default 0,
  "discountPercent" numeric default 0,
  notes text,
  terms text,
  status text default 'Draft',
  "createdBy" text,
  "createdAt" timestamptz default now(),
  "sentAt" timestamptz,
  deletedat timestamptz,
  deletedby text
);

-- Singleton row (id = 'default') holding the company profile shown on
-- every invoice's PDF header, plus the running invoice-number counter.
create table if not exists invoice_settings (
  id text primary key default 'default',
  "companyName" text,
  "companyEmail" text,
  "companyPhone" text,
  "companyAddress" text,
  "companyGstin" text,
  "companyLogo" text,
  "bankAccountName" text,
  "bankAccountNumber" text,
  "bankIfsc" text,
  "currencySymbol" text default '$',
  "nextInvoiceNumber" integer default 1
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

-- Invoicing is an opt-in permission the Super Admin grants per-user,
-- independent of role (task_owner/task_assignee accounts can be given
-- access without changing their role):
-- alter table users add column if not exists "canAccessInvoices" boolean default false;

-- GST fields for Indian billing: company GSTIN (admin-only, one-time setup
-- in Company Info) and client GSTIN (standalone per-invoice input). If your
-- invoices / invoice_settings tables predate this, run:
-- alter table invoices add column if not exists "clientGstin" text;
-- alter table invoice_settings add column if not exists "companyGstin" text;

-- Company logo + bank account details (admin-only, one-time setup in
-- Company Info, shown on every invoice). If your invoice_settings table
-- predates this, run:
-- alter table invoice_settings add column if not exists "companyLogo" text;
-- alter table invoice_settings add column if not exists "bankAccountName" text;
-- alter table invoice_settings add column if not exists "bankAccountNumber" text;
-- alter table invoice_settings add column if not exists "bankIfsc" text;

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
alter table invoices enable row level security;
alter table invoice_settings enable row level security;
