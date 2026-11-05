-- Every identity remains customer-primary. Business roles are additive membership roles.
-- Normalize all legacy group values before tightening constraints.
update public.users
set secondary_group = case
  when primary_group in ('staff','owner','developer')
    or secondary_group in ('staff','owner','developer') then 'staff'
  else null
end,
primary_group = 'customer',
updated_at = now();

-- Preserve the business association for existing members created before the identity merge.
update public.users u
set business_id = bm.business_id, updated_at = now()
from public.business_members bm
where bm.user_id = u.id and bm.is_active = true and u.business_id is null;

alter table public.users drop constraint if exists users_primary_group_check;
alter table public.users add constraint users_primary_group_check check (primary_group = 'customer');
alter table public.users drop constraint if exists users_secondary_group_check;
alter table public.users add constraint users_secondary_group_check check (secondary_group is null or secondary_group = 'staff');
alter table public.users drop constraint if exists users_secondary_group_distinct;

create or replace view public.customers with (security_invoker=true) as
select id,business_id,id as user_id,full_name,email,phone,address,suburb,state,postcode,
       customer_internal_notes as internal_notes,customer_status as status,created_at,updated_at
from public.users where primary_group = 'customer';

create or replace view public.staff with (security_invoker=true) as
select u.id,u.business_id,u.id as user_id,u.employee_number,u.job_title,u.employment_status,
       u.start_date,u.emergency_contact_name,u.emergency_contact_phone,
       u.employee_internal_notes as internal_notes,u.created_at,u.updated_at,
       u.full_name,u.email,u.phone,u.status as account_status
from public.users u
where u.secondary_group = 'staff'
   or exists (select 1 from public.business_members bm where bm.user_id=u.id and bm.is_active=true);

create or replace function public.brandon_rv_staff_view_write()
returns trigger language plpgsql security invoker set search_path=public as $$
declare v_id uuid;
begin
 if tg_op='DELETE' then
  update public.users set secondary_group=null,employment_status='inactive',updated_at=now() where id=old.id;
  update public.business_members set is_active=false where user_id=old.id and business_id=old.business_id;
  return old;
 elsif tg_op='INSERT' then
  v_id:=new.user_id;
  if v_id is null and new.email is not null then select id into v_id from public.users where email=lower(btrim(new.email)) limit 1;end if;
  if v_id is not null then
   update public.users set business_id=coalesce(new.business_id,business_id),primary_group='customer',secondary_group='staff',
    employee_number=new.employee_number,job_title=new.job_title,employment_status=coalesce(new.employment_status,'active'),
    start_date=new.start_date,emergency_contact_name=new.emergency_contact_name,emergency_contact_phone=new.emergency_contact_phone,
    employee_internal_notes=new.internal_notes,updated_at=now() where id=v_id;
  else
   if new.email is null or btrim(new.email)='' then raise exception 'A staff account requires an email address';end if;
   insert into public.users(email,password_hash,full_name,phone,account_type,status,business_id,primary_group,secondary_group,
    employee_number,job_title,employment_status,start_date,emergency_contact_name,emergency_contact_phone,employee_internal_notes)
   values(lower(btrim(new.email)),null,coalesce(nullif(new.full_name,''),'Staff member'),new.phone,'customer','pending',
    new.business_id,'customer','staff',new.employee_number,new.job_title,coalesce(new.employment_status,'active'),
    new.start_date,new.emergency_contact_name,new.emergency_contact_phone,new.internal_notes) returning id into v_id;
  end if;
  new.id:=v_id;new.user_id:=v_id;return new;
 else
  update public.users set business_id=new.business_id,primary_group='customer',secondary_group='staff',
   employee_number=new.employee_number,job_title=new.job_title,employment_status=new.employment_status,start_date=new.start_date,
   emergency_contact_name=new.emergency_contact_name,emergency_contact_phone=new.emergency_contact_phone,
   employee_internal_notes=new.internal_notes,updated_at=now() where id=old.id;
  new.id:=old.id;new.user_id:=old.id;return new;
 end if;
end $$;

comment on column public.users.primary_group is 'Always customer. All users have customer account identity.';
comment on column public.users.secondary_group is 'Compatibility flag for employee/business access. Specific roles and permissions are stored in business_members and permission groups.';

 
-- Keep employee access intact if a customer record is deactivated or removed.
create or replace function public.brandon_rv_customers_view_write()
returns trigger language plpgsql security invoker set search_path=public as $$
declare v_id uuid;
begin
 if tg_op='DELETE' then
  if old.secondary_group='staff' or exists(select 1 from public.business_members bm where bm.user_id=old.id and bm.is_active=true) then
   update public.users set customer_status='inactive',updated_at=now() where id=old.id;
  else
   delete from public.users where id=old.id;
  end if;
  return old;
 elsif tg_op='INSERT' then
  v_id:=new.user_id;
  if v_id is null and new.email is not null then select id into v_id from public.users where email=lower(btrim(new.email)) limit 1;end if;
  if v_id is not null then
   update public.users set business_id=coalesce(new.business_id,business_id),
    full_name=coalesce(nullif(new.full_name,''),full_name),email=coalesce(lower(btrim(new.email)),email),
    phone=coalesce(new.phone,phone),address=new.address,suburb=new.suburb,state=new.state,postcode=new.postcode,
    customer_internal_notes=new.internal_notes,customer_status=coalesce(new.status,'active'),
    primary_group='customer',updated_at=now() where id=v_id;
  else
   if new.email is null or btrim(new.email)='' then raise exception 'A customer account requires an email address';end if;
   insert into public.users(email,password_hash,full_name,phone,account_type,status,business_id,primary_group,
    customer_status,address,suburb,state,postcode,customer_internal_notes)
   values(lower(btrim(new.email)),null,coalesce(nullif(new.full_name,''),'Customer'),new.phone,'customer','pending',
    new.business_id,'customer',coalesce(new.status,'active'),new.address,new.suburb,new.state,new.postcode,new.internal_notes)
   returning id into v_id;
  end if;
  new.id:=v_id;new.user_id:=v_id;return new;
 else
  update public.users set business_id=new.business_id,full_name=new.full_name,email=lower(btrim(new.email)),
   phone=new.phone,address=new.address,suburb=new.suburb,state=new.state,postcode=new.postcode,
   customer_internal_notes=new.internal_notes,customer_status=coalesce(new.status,'active'),
   primary_group='customer',updated_at=now() where id=old.id;
  new.id:=old.id;new.user_id:=old.id;return new;
 end if;
end $$;
