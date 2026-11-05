create extension if not exists pgcrypto;

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  password_hash text not null,
  full_name text not null,
  phone text,
  account_type text not null default 'customer' check (account_type in ('customer','staff','owner')),
  status text not null default 'pending' check (status in ('pending','active','suspended','disabled')),
  email_verified_at timestamptz,
  last_login_at timestamptz,
  force_password_change boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint users_email_normalized check (email = lower(btrim(email)))
);
create unique index if not exists users_email_unique on public.users (email);

create table if not exists public.staff (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null unique references public.users(id) on delete cascade,
  employee_number text,
  job_title text,
  employment_status text not null default 'active' check (employment_status in ('active','on_leave','inactive','terminated')),
  start_date date,
  emergency_contact_name text,
  emergency_contact_phone text,
  internal_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, employee_number)
);

create table if not exists public.user_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  user_agent text,
  ip_hash text
);
create index if not exists user_sessions_user_id_idx on public.user_sessions(user_id);
create index if not exists user_sessions_expiry_idx on public.user_sessions(expires_at);

create table if not exists public.password_reset_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists password_reset_tokens_user_idx on public.password_reset_tokens(user_id);

create table if not exists public.user_invitations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  email text not null,
  full_name text not null,
  account_type text not null check (account_type in ('staff','owner')),
  role text not null,
  token_hash text not null unique,
  invited_by uuid references public.users(id) on delete set null,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  constraint user_invitations_email_normalized check (email = lower(btrim(email)))
);
create index if not exists user_invitations_email_idx on public.user_invitations(email);

create table if not exists public.login_attempts (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  ip_hash text,
  attempted_at timestamptz not null default now(),
  succeeded boolean not null default false
);
create index if not exists login_attempts_email_time_idx on public.login_attempts(email, attempted_at desc);

do $$
declare r record;
begin
  for r in
    select * from (values
      ('business_members','user_id','business_members_user_id_users_fkey'),
      ('customers','user_id','customers_user_id_users_fkey'),
      ('appointments','user_id','appointments_user_id_users_fkey'),
      ('audit_events','actor_user_id','audit_events_actor_user_id_users_fkey'),
      ('documents','user_id','documents_user_id_users_fkey'),
      ('enquiries','user_id','enquiries_user_id_users_fkey'),
      ('enquiry_attachments','uploaded_by','enquiry_attachments_uploaded_by_users_fkey'),
      ('invoices','user_id','invoices_user_id_users_fkey'),
      ('jobs','user_id','jobs_user_id_users_fkey'),
      ('notifications','user_id','notifications_user_id_users_fkey'),
      ('payments','user_id','payments_user_id_users_fkey'),
      ('quotes','user_id','quotes_user_id_users_fkey')
    ) as x(table_name,column_name,constraint_name)
  loop
    if not exists (select 1 from pg_constraint where conname = r.constraint_name) then
      execute format('alter table public.%I add constraint %I foreign key (%I) references public.users(id) on delete set null', r.table_name, r.constraint_name, r.column_name);
    end if;
  end loop;
end $$;

alter table public.users enable row level security;
alter table public.staff enable row level security;
alter table public.user_sessions enable row level security;
alter table public.password_reset_tokens enable row level security;
alter table public.user_invitations enable row level security;
alter table public.login_attempts enable row level security;

revoke all on public.users, public.staff, public.user_sessions, public.password_reset_tokens, public.user_invitations, public.login_attempts from anon, authenticated;
grant all on public.users, public.staff, public.user_sessions, public.password_reset_tokens, public.user_invitations, public.login_attempts to service_role;

comment on table public.users is 'Authoritative Brandon RV application accounts. Supabase Auth is not used for these accounts.';
comment on table public.staff is 'Employee profile and employment information linked to a Brandon RV application user.';
comment on table public.user_sessions is 'Hashed opaque session tokens for Brandon RV custom login.';
