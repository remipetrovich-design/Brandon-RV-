create table if not exists public.application_license (
 id text primary key check (id = 'primary'),
 product_id text not null,
 installation_id text not null unique,
 encrypted_license_key text not null,
 encryption_iv text not null,
 encryption_tag text not null,
 last_validated_at timestamptz,
 last_status text not null default 'unknown',
 last_error_code text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.application_license enable row level security;
revoke all on public.application_license from anon, authenticated;
