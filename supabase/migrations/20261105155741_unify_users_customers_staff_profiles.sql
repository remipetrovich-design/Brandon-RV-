-- Single Brandon RV account identity table; customer, staff and profile compatibility views only.
alter table public.users alter column email drop not null;
alter table public.users alter column password_hash drop not null;
alter table public.users add column if not exists business_id uuid references public.businesses(id) on delete set null;
alter table public.users add column if not exists primary_group text not null default 'customer';
alter table public.users add column if not exists secondary_group text;
alter table public.users add column if not exists avatar_path text;
alter table public.users add column if not exists address text;
alter table public.users add column if not exists suburb text;
alter table public.users add column if not exists state text;
alter table public.users add column if not exists postcode text;
alter table public.users add column if not exists customer_status text not null default 'active';
alter table public.users add column if not exists customer_internal_notes text;
alter table public.users add column if not exists employee_number text;
alter table public.users add column if not exists job_title text;
alter table public.users add column if not exists employment_status text not null default 'active';
alter table public.users add column if not exists start_date date;
alter table public.users add column if not exists emergency_contact_name text;
alter table public.users add column if not exists emergency_contact_phone text;
alter table public.users add column if not exists employee_internal_notes text;
alter table public.users add constraint users_primary_group_check check(primary_group in ('customer','staff','owner','developer'));
alter table public.users add constraint users_secondary_group_check check(secondary_group is null or secondary_group in ('customer','staff','owner','developer'));
alter table public.users add constraint users_secondary_group_distinct check(secondary_group is null or secondary_group<>primary_group);
alter table public.users add constraint users_customer_status_check check(customer_status in ('active','inactive'));
alter table public.users add constraint users_employment_status_check check(employment_status in ('active','on_leave','inactive','terminated'));
drop policy if exists "customers manage own vehicles" on public.vehicles;
do $$
declare r record; v_name text;
begin
 for r in select c.conname,c.conrelid::regclass as source_table,a.attname as source_column from pg_constraint c join pg_attribute a on a.attrelid=c.conrelid and a.attnum=any(c.conkey) where c.contype='f' and c.confrelid in ('public.customers'::regclass,'public.staff'::regclass)
 loop
  execute format('alter table %s drop constraint %I',r.source_table,r.conname);
  v_name:=left(replace(r.conname,'_fkey','')||'_users_fkey',63);
  execute format('alter table %s add constraint %I foreign key (%I) references public.users(id) on delete restrict',r.source_table,v_name,r.source_column);
 end loop;
end $$;
drop table public.customers;
drop table public.staff;
drop table public.profiles;
create policy "customers manage own vehicles" on public.vehicles for all to authenticated using(customer_id=(select auth.uid())) with check(customer_id=(select auth.uid()));
create or replace view public.customers with (security_invoker=true) as select id,business_id,id as user_id,full_name,email,phone,address,suburb,state,postcode,customer_internal_notes as internal_notes,customer_status as status,created_at,updated_at from public.users where primary_group='customer' or secondary_group='customer';
create or replace function public.brandon_rv_customers_view_write() returns trigger language plpgsql security invoker set search_path=public as $$
declare v_id uuid;
begin
 if tg_op='DELETE' then if old.secondary_group in ('staff','owner','developer') then update public.users set primary_group=secondary_group,secondary_group=null,customer_status='inactive',updated_at=now() where id=old.id; else delete from public.users where id=old.id; end if;return old;
 elsif tg_op='INSERT' then
  v_id:=new.user_id;if v_id is null and new.email is not null then select id into v_id from public.users where email=lower(btrim(new.email)) limit 1;end if;
  if v_id is not null then update public.users set business_id=coalesce(new.business_id,business_id),full_name=coalesce(nullif(new.full_name,''),full_name),email=coalesce(lower(btrim(new.email)),email),phone=coalesce(new.phone,phone),address=new.address,suburb=new.suburb,state=new.state,postcode=new.postcode,customer_internal_notes=new.internal_notes,customer_status=coalesce(new.status,'active'),primary_group=case when primary_group in ('staff','owner','developer') then primary_group else 'customer' end,secondary_group=case when primary_group in ('staff','owner','developer') then 'customer' else secondary_group end,updated_at=now() where id=v_id;
  else if new.email is null or btrim(new.email)='' then raise exception 'A customer account requires an email address';end if;
   insert into public.users(email,password_hash,full_name,phone,account_type,status,business_id,primary_group,customer_status,address,suburb,state,postcode,customer_internal_notes) values(lower(btrim(new.email)),null,coalesce(nullif(new.full_name,''),'Customer'),new.phone,'customer','pending',new.business_id,'customer',coalesce(new.status,'active'),new.address,new.suburb,new.state,new.postcode,new.internal_notes) returning id into v_id;
  end if;new.id:=v_id;new.user_id:=v_id;return new;
 else update public.users set business_id=new.business_id,full_name=new.full_name,email=lower(btrim(new.email)),phone=new.phone,address=new.address,suburb=new.suburb,state=new.state,postcode=new.postcode,customer_internal_notes=new.internal_notes,customer_status=coalesce(new.status,'active'),updated_at=now() where id=old.id;new.id:=old.id;new.user_id:=old.id;return new;
 end if;
end $$;
create trigger customers_view_write instead of insert or update or delete on public.customers for each row execute function public.brandon_rv_customers_view_write();
create or replace view public.staff with (security_invoker=true) as select id,business_id,id as user_id,employee_number,job_title,employment_status,start_date,emergency_contact_name,emergency_contact_phone,employee_internal_notes as internal_notes,created_at,updated_at,full_name,email,phone,status as account_status from public.users where primary_group in ('staff','owner','developer') or secondary_group in ('staff','owner','developer');
create or replace function public.brandon_rv_staff_view_write() returns trigger language plpgsql security invoker set search_path=public as $$
declare v_id uuid;
begin
 if tg_op='DELETE' then if old.secondary_group='customer' then update public.users set primary_group='customer',secondary_group=null,employment_status='inactive',updated_at=now() where id=old.id;else update public.users set employment_status='inactive',status='suspended',updated_at=now() where id=old.id;end if;update public.business_members set is_active=false where user_id=old.id and business_id=old.business_id;return old;
 elsif tg_op='INSERT' then v_id:=new.user_id;if v_id is null and new.email is not null then select id into v_id from public.users where email=lower(btrim(new.email)) limit 1;end if;
  if v_id is not null then update public.users set business_id=coalesce(new.business_id,business_id),primary_group=case when primary_group='customer' then 'staff' else primary_group end,secondary_group=case when primary_group='customer' then 'customer' else secondary_group end,account_type=case when account_type='owner' then 'owner' else 'staff' end,employee_number=new.employee_number,job_title=new.job_title,employment_status=coalesce(new.employment_status,'active'),start_date=new.start_date,emergency_contact_name=new.emergency_contact_name,emergency_contact_phone=new.emergency_contact_phone,employee_internal_notes=new.internal_notes,updated_at=now() where id=v_id;
  else if new.email is null or btrim(new.email)='' then raise exception 'A staff account requires an email address';end if;insert into public.users(email,password_hash,full_name,phone,account_type,status,business_id,primary_group,employee_number,job_title,employment_status,start_date,emergency_contact_name,emergency_contact_phone,employee_internal_notes) values(lower(btrim(new.email)),null,coalesce(nullif(new.full_name,''),'Staff member'),new.phone,'staff','pending',new.business_id,'staff',new.employee_number,new.job_title,coalesce(new.employment_status,'active'),new.start_date,new.emergency_contact_name,new.emergency_contact_phone,new.internal_notes) returning id into v_id;end if;new.id:=v_id;new.user_id:=v_id;return new;
 else update public.users set business_id=new.business_id,employee_number=new.employee_number,job_title=new.job_title,employment_status=new.employment_status,start_date=new.start_date,emergency_contact_name=new.emergency_contact_name,emergency_contact_phone=new.emergency_contact_phone,employee_internal_notes=new.internal_notes,updated_at=now() where id=old.id;new.id:=old.id;new.user_id:=old.id;return new;end if;
end $$;
create trigger staff_view_write instead of insert or update or delete on public.staff for each row execute function public.brandon_rv_staff_view_write();
create or replace view public.profiles with (security_invoker=true) as select id,full_name,phone,avatar_path,created_at,updated_at from public.users;
create or replace function public.brandon_rv_profiles_view_write() returns trigger language plpgsql security invoker set search_path=public as $$ begin if tg_op='DELETE' then return old;end if;update public.users set full_name=coalesce(new.full_name,full_name),phone=new.phone,avatar_path=new.avatar_path,updated_at=now() where id=old.id;return new;end $$;
create trigger profiles_view_write instead of update on public.profiles for each row execute function public.brandon_rv_profiles_view_write();
revoke all on public.customers,public.staff,public.profiles from anon,authenticated;
grant select,insert,update,delete on public.customers,public.staff to service_role;
grant select,update on public.profiles to service_role;
grant all on public.users to service_role;
comment on table public.users is 'Single Brandon RV account identity table. Customer and employee details and primary/secondary account groups are stored on this row.';
comment on column public.users.primary_group is 'Primary account group: customer, staff, owner, or developer.';
comment on column public.users.secondary_group is 'Optional secondary account group, allowing one login to be both customer and staff.';
