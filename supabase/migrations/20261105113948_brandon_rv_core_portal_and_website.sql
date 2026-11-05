
create extension if not exists pgcrypto;
create schema if not exists private;

create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  brand_line text,
  phone text,
  public_email text,
  city text,
  region text,
  country text not null default 'Australia',
  status text not null default 'prelaunch' check (status in ('prelaunch','active','paused')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  avatar_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.business_members (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'staff' check (role in ('owner','administrator','manager','technician','office','accounts')),
  is_active boolean not null default true,
  invited_at timestamptz,
  joined_at timestamptz,
  created_at timestamptz not null default now(),
  unique (business_id, user_id)
);

create table public.permissions (
  permission_key text primary key,
  description text not null
);

create table public.permission_groups (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  description text,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  unique (business_id, name)
);

create table public.permission_group_permissions (
  group_id uuid not null references public.permission_groups(id) on delete cascade,
  permission_key text not null references public.permissions(permission_key) on delete cascade,
  primary key (group_id, permission_key)
);

create table public.member_permission_groups (
  member_id uuid not null references public.business_members(id) on delete cascade,
  group_id uuid not null references public.permission_groups(id) on delete cascade,
  primary key (member_id, group_id)
);

create table public.business_settings (
  business_id uuid primary key references public.businesses(id) on delete cascade,
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table public.site_pages (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  slug text not null,
  title text not null,
  content jsonb not null default '{}'::jsonb,
  meta_title text,
  meta_description text,
  is_published boolean not null default false,
  published_at timestamptz,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, slug)
);

create table public.services (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  slug text not null,
  category text,
  description text,
  scope_notes text,
  is_active boolean not null default true,
  is_published boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, slug)
);

create table public.service_areas (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  description text,
  radius_km numeric(8,2),
  travel_fee numeric(12,2),
  is_published boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  full_name text not null,
  email text,
  phone text,
  address text,
  suburb text,
  state text,
  postcode text,
  internal_notes text,
  status text not null default 'active' check (status in ('active','inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, user_id)
);

create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  make text,
  model text,
  year integer,
  vehicle_type text,
  registration text,
  vin text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.enquiries (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  contact_name text not null,
  email text not null,
  phone text,
  location text,
  vehicle_description text,
  requested_service text,
  description text not null,
  preferred_contact text default 'email',
  status text not null default 'new' check (status in ('new','reviewing','quoted','accepted','declined','converted','closed')),
  source text default 'website',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete restrict,
  user_id uuid references auth.users(id) on delete set null,
  enquiry_id uuid references public.enquiries(id) on delete set null,
  quote_number text not null,
  status text not null default 'draft' check (status in ('draft','sent','accepted','declined','expired','converted')),
  issue_date date not null default current_date,
  expiry_date date,
  subtotal numeric(12,2) not null default 0,
  tax_amount numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  notes text,
  terms text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, quote_number)
);

create table public.quote_items (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes(id) on delete cascade,
  description text not null,
  quantity numeric(10,2) not null default 1 check (quantity > 0),
  unit_price numeric(12,2) not null default 0 check (unit_price >= 0),
  tax_rate numeric(5,2) not null default 0,
  line_total numeric(12,2) not null default 0,
  sort_order integer not null default 0
);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete restrict,
  user_id uuid references auth.users(id) on delete set null,
  enquiry_id uuid references public.enquiries(id) on delete set null,
  quote_id uuid references public.quotes(id) on delete set null,
  starts_at timestamptz,
  ends_at timestamptz,
  location text,
  status text not null default 'requested' check (status in ('requested','confirmed','rescheduled','completed','cancelled')),
  customer_notes text,
  internal_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete restrict,
  user_id uuid references auth.users(id) on delete set null,
  appointment_id uuid references public.appointments(id) on delete set null,
  quote_id uuid references public.quotes(id) on delete set null,
  job_number text not null,
  title text not null,
  scope_of_work text,
  status text not null default 'scheduled' check (status in ('scheduled','in_progress','waiting_parts','completed','cancelled')),
  scheduled_start timestamptz,
  scheduled_end timestamptz,
  completed_at timestamptz,
  customer_visible_notes text,
  internal_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, job_number)
);

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete restrict,
  user_id uuid references auth.users(id) on delete set null,
  job_id uuid references public.jobs(id) on delete set null,
  quote_id uuid references public.quotes(id) on delete set null,
  invoice_number text not null,
  status text not null default 'draft' check (status in ('draft','issued','part_paid','paid','overdue','void')),
  issue_date date not null default current_date,
  due_date date,
  subtotal numeric(12,2) not null default 0,
  tax_amount numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  amount_paid numeric(12,2) not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, invoice_number)
);

create table public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  description text not null,
  quantity numeric(10,2) not null default 1 check (quantity > 0),
  unit_price numeric(12,2) not null default 0 check (unit_price >= 0),
  tax_rate numeric(5,2) not null default 0,
  line_total numeric(12,2) not null default 0,
  sort_order integer not null default 0
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  invoice_id uuid not null references public.invoices(id) on delete restrict,
  customer_id uuid not null references public.customers(id) on delete restrict,
  user_id uuid references auth.users(id) on delete set null,
  amount numeric(12,2) not null check (amount > 0),
  method text,
  reference text,
  status text not null default 'recorded' check (status in ('pending','recorded','failed','refunded')),
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  job_id uuid references public.jobs(id) on delete set null,
  quote_id uuid references public.quotes(id) on delete set null,
  invoice_id uuid references public.invoices(id) on delete set null,
  name text not null,
  storage_path text not null,
  document_type text not null default 'other',
  is_customer_visible boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  body text,
  category text not null default 'general',
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

insert into public.permissions(permission_key, description) values
 ('website.manage','Edit and publish public website content'),
 ('business.settings.manage','Manage business settings and service areas'),
 ('customers.manage','Manage customer records and vehicles'),
 ('enquiries.manage','Review and respond to enquiries'),
 ('quotes.manage','Create and manage quotes'),
 ('appointments.manage','Manage appointments and calendar'),
 ('jobs.manage','Manage jobs and job records'),
 ('documents.manage','Manage business and customer documents'),
 ('invoices.manage','Create and manage invoices'),
 ('payments.manage','Record and review payments'),
 ('staff.manage','Invite staff and manage access'),
 ('reports.view','View business reports'),
 ('expenses.manage','Manage business expenses')
on conflict do nothing;

insert into public.businesses(name, slug, brand_line, phone, public_email, city, region, status)
values ('Brandon RV','brandon-rv','From Factory Experience to Repairs On The Go','0407 189 087','enquires@brandonrv.com.au','Tamworth','NSW','prelaunch')
on conflict (slug) do nothing;

insert into public.business_settings(business_id, settings)
select id, jsonb_build_object(
  'timezone','Australia/Sydney',
  'booking_requires_confirmation',true,
  'public_email_verification_required',true,
  'service_scope_approval_required',true
)
from public.businesses where slug='brandon-rv'
on conflict (business_id) do nothing;

create or replace function private.is_business_member(p_business_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.business_members m
    where m.business_id = p_business_id
      and m.user_id = (select auth.uid())
      and m.is_active = true
  );
$$;

create or replace function private.has_business_role(p_business_id uuid, p_roles text[])
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.business_members m
    where m.business_id = p_business_id
      and m.user_id = (select auth.uid())
      and m.is_active = true
      and m.role = any(p_roles)
  );
$$;

create or replace function private.has_business_permission(p_business_id uuid, p_permission text)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select
    private.has_business_role(p_business_id, array['owner','administrator'])
    or exists (
      select 1
      from public.business_members m
      join public.member_permission_groups mpg on mpg.member_id = m.id
      join public.permission_group_permissions pgp on pgp.group_id = mpg.group_id
      where m.business_id = p_business_id
        and m.user_id = (select auth.uid())
        and m.is_active = true
        and pgp.permission_key = p_permission
    );
$$;

revoke all on function private.is_business_member(uuid) from public, anon;
revoke all on function private.has_business_role(uuid,text[]) from public, anon;
revoke all on function private.has_business_permission(uuid,text) from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.is_business_member(uuid) to authenticated;
grant execute on function private.has_business_role(uuid,text[]) to authenticated;
grant execute on function private.has_business_permission(uuid,text) to authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles(id, full_name)
  values (new.id, nullif(new.raw_user_meta_data ->> 'full_name',''))
  on conflict (id) do nothing;
  return new;
end;
$$;
revoke all on function public.handle_new_user() from public, anon, authenticated;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

alter table public.businesses enable row level security;
alter table public.profiles enable row level security;
alter table public.business_members enable row level security;
alter table public.permissions enable row level security;
alter table public.permission_groups enable row level security;
alter table public.permission_group_permissions enable row level security;
alter table public.member_permission_groups enable row level security;
alter table public.business_settings enable row level security;
alter table public.site_pages enable row level security;
alter table public.services enable row level security;
alter table public.service_areas enable row level security;
alter table public.customers enable row level security;
alter table public.vehicles enable row level security;
alter table public.enquiries enable row level security;
alter table public.quotes enable row level security;
alter table public.quote_items enable row level security;
alter table public.appointments enable row level security;
alter table public.jobs enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;
alter table public.payments enable row level security;
alter table public.documents enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_events enable row level security;

grant select on public.businesses, public.site_pages, public.services, public.service_areas to anon, authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select on public.permissions to authenticated;
grant select, insert, update, delete on public.business_members, public.permission_groups, public.permission_group_permissions, public.member_permission_groups to authenticated;
grant select, insert, update on public.business_settings, public.site_pages, public.services, public.service_areas to authenticated;
grant select, insert, update on public.customers, public.vehicles, public.enquiries, public.quotes, public.quote_items, public.appointments, public.jobs, public.invoices, public.invoice_items, public.payments, public.documents, public.notifications, public.audit_events to authenticated;
grant insert on public.enquiries to anon;

create policy "public can view published business" on public.businesses
for select to anon, authenticated using (status = 'active' or status = 'prelaunch');

create policy "users view own profile" on public.profiles
for select to authenticated using (id = (select auth.uid()));
create policy "users create own profile" on public.profiles
for insert to authenticated with check (id = (select auth.uid()));
create policy "users update own profile" on public.profiles
for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "members view business membership" on public.business_members
for select to authenticated using (user_id = (select auth.uid()) or private.has_business_role(business_id,array['owner','administrator']));
create policy "owners manage business membership" on public.business_members
for all to authenticated using (private.has_business_role(business_id,array['owner','administrator'])) with check (private.has_business_role(business_id,array['owner','administrator']));

create policy "authenticated view permission catalogue" on public.permissions
for select to authenticated using (true);
create policy "admins manage permission groups" on public.permission_groups
for all to authenticated using (private.has_business_role(business_id,array['owner','administrator'])) with check (private.has_business_role(business_id,array['owner','administrator']));
create policy "admins manage group permissions" on public.permission_group_permissions
for all to authenticated using (exists (select 1 from public.permission_groups g where g.id = group_id and private.has_business_role(g.business_id,array['owner','administrator']))) with check (exists (select 1 from public.permission_groups g where g.id = group_id and private.has_business_role(g.business_id,array['owner','administrator'])));
create policy "admins manage member groups" on public.member_permission_groups
for all to authenticated using (exists (select 1 from public.business_members m where m.id = member_id and private.has_business_role(m.business_id,array['owner','administrator']))) with check (exists (select 1 from public.business_members m where m.id = member_id and private.has_business_role(m.business_id,array['owner','administrator'])));

create policy "business settings staff access" on public.business_settings
for all to authenticated using (private.has_business_role(business_id,array['owner','administrator','manager'])) with check (private.has_business_role(business_id,array['owner','administrator','manager']));

create policy "public reads published pages" on public.site_pages
for select to anon, authenticated using (is_published = true);
create policy "staff manage pages" on public.site_pages
for all to authenticated using (private.has_business_permission(business_id,'website.manage')) with check (private.has_business_permission(business_id,'website.manage'));

create policy "public reads published services" on public.services
for select to anon, authenticated using (is_published = true and is_active = true);
create policy "staff manage services" on public.services
for all to authenticated using (private.has_business_permission(business_id,'business.settings.manage')) with check (private.has_business_permission(business_id,'business.settings.manage'));

create policy "public reads published service areas" on public.service_areas
for select to anon, authenticated using (is_published = true);
create policy "staff manage service areas" on public.service_areas
for all to authenticated using (private.has_business_permission(business_id,'business.settings.manage')) with check (private.has_business_permission(business_id,'business.settings.manage'));

create policy "staff manage customers" on public.customers
for all to authenticated using (private.has_business_permission(business_id,'customers.manage')) with check (private.has_business_permission(business_id,'customers.manage'));
create policy "customers view own record" on public.customers
for select to authenticated using (user_id = (select auth.uid()));

create policy "customers manage own vehicles" on public.vehicles
for all to authenticated using (exists (select 1 from public.customers c where c.id = customer_id and c.user_id = (select auth.uid()))) with check (exists (select 1 from public.customers c where c.id = customer_id and c.user_id = (select auth.uid())));
create policy "staff manage vehicles" on public.vehicles
for all to authenticated using (private.has_business_permission(business_id,'customers.manage')) with check (private.has_business_permission(business_id,'customers.manage'));

create policy "public submit enquiry" on public.enquiries
for insert to anon, authenticated
with check (status = 'new' and source = 'website' and customer_id is null and user_id is null);
create policy "customers submit own enquiry" on public.enquiries
for insert to authenticated
with check (status = 'new' and user_id = (select auth.uid()));
create policy "customers view own enquiries" on public.enquiries
for select to authenticated using (user_id = (select auth.uid()));
create policy "staff manage enquiries" on public.enquiries
for all to authenticated using (private.has_business_permission(business_id,'enquiries.manage')) with check (private.has_business_permission(business_id,'enquiries.manage'));

create policy "customers view own quotes" on public.quotes
for select to authenticated using (user_id = (select auth.uid()));
create policy "staff manage quotes" on public.quotes
for all to authenticated using (private.has_business_permission(business_id,'quotes.manage')) with check (private.has_business_permission(business_id,'quotes.manage'));
create policy "customers view quote items" on public.quote_items
for select to authenticated using (exists (select 1 from public.quotes q where q.id = quote_id and q.user_id = (select auth.uid())));
create policy "staff manage quote items" on public.quote_items
for all to authenticated using (exists (select 1 from public.quotes q where q.id = quote_id and private.has_business_permission(q.business_id,'quotes.manage'))) with check (exists (select 1 from public.quotes q where q.id = quote_id and private.has_business_permission(q.business_id,'quotes.manage')));

create policy "customers view own appointments" on public.appointments
for select to authenticated using (user_id = (select auth.uid()));
create policy "staff manage appointments" on public.appointments
for all to authenticated using (private.has_business_permission(business_id,'appointments.manage')) with check (private.has_business_permission(business_id,'appointments.manage'));

create policy "customers view own jobs" on public.jobs
for select to authenticated using (user_id = (select auth.uid()));
create policy "staff manage jobs" on public.jobs
for all to authenticated using (private.has_business_permission(business_id,'jobs.manage')) with check (private.has_business_permission(business_id,'jobs.manage'));

create policy "customers view own invoices" on public.invoices
for select to authenticated using (user_id = (select auth.uid()));
create policy "staff manage invoices" on public.invoices
for all to authenticated using (private.has_business_permission(business_id,'invoices.manage')) with check (private.has_business_permission(business_id,'invoices.manage'));
create policy "customers view invoice items" on public.invoice_items
for select to authenticated using (exists (select 1 from public.invoices i where i.id = invoice_id and i.user_id = (select auth.uid())));
create policy "staff manage invoice items" on public.invoice_items
for all to authenticated using (exists (select 1 from public.invoices i where i.id = invoice_id and private.has_business_permission(i.business_id,'invoices.manage'))) with check (exists (select 1 from public.invoices i where i.id = invoice_id and private.has_business_permission(i.business_id,'invoices.manage')));

create policy "customers view own payments" on public.payments
for select to authenticated using (user_id = (select auth.uid()));
create policy "staff manage payments" on public.payments
for all to authenticated using (private.has_business_permission(business_id,'payments.manage')) with check (private.has_business_permission(business_id,'payments.manage'));

create policy "customers view visible documents" on public.documents
for select to authenticated using (user_id = (select auth.uid()) and is_customer_visible = true);
create policy "staff manage documents" on public.documents
for all to authenticated using (private.has_business_permission(business_id,'documents.manage')) with check (private.has_business_permission(business_id,'documents.manage'));

create policy "users view own notifications" on public.notifications
for select to authenticated using (user_id = (select auth.uid()));
create policy "users update own notifications" on public.notifications
for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "staff create notifications" on public.notifications
for insert to authenticated with check (private.is_business_member(business_id));

create policy "admins view audit events" on public.audit_events
for select to authenticated using (private.has_business_role(business_id,array['owner','administrator']));
create policy "members create audit events" on public.audit_events
for insert to authenticated with check (actor_user_id = (select auth.uid()) and private.is_business_member(business_id));

create index on public.business_members(user_id, business_id) where is_active;
create index on public.customers(business_id, email);
create index on public.vehicles(customer_id);
create index on public.enquiries(business_id, status, created_at desc);
create index on public.quotes(customer_id, status);
create index on public.appointments(business_id, starts_at);
create index on public.jobs(business_id, status, scheduled_start);
create index on public.invoices(customer_id, status, due_date);
create index on public.payments(invoice_id, paid_at);
create index on public.documents(customer_id, created_at desc);
create index on public.notifications(user_id, created_at desc);
