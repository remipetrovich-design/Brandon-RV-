alter table public.appointments drop constraint if exists appointments_user_id_fkey;
alter table public.audit_events drop constraint if exists audit_events_actor_user_id_fkey;
alter table public.business_members drop constraint if exists business_members_user_id_fkey;
alter table public.customers drop constraint if exists customers_user_id_fkey;
alter table public.documents drop constraint if exists documents_user_id_fkey;
alter table public.enquiries drop constraint if exists enquiries_user_id_fkey;
alter table public.enquiry_attachments drop constraint if exists enquiry_attachments_uploaded_by_fkey;
alter table public.invoices drop constraint if exists invoices_user_id_fkey;
alter table public.jobs drop constraint if exists jobs_user_id_fkey;
alter table public.notifications drop constraint if exists notifications_user_id_fkey;
alter table public.payments drop constraint if exists payments_user_id_fkey;
alter table public.quotes drop constraint if exists quotes_user_id_fkey;
alter table public.profiles drop constraint if exists profiles_id_fkey;

alter table public.business_members drop constraint if exists business_members_user_id_users_fkey;
alter table public.business_members add constraint business_members_user_id_users_fkey foreign key (user_id) references public.users(id) on delete cascade;
alter table public.notifications drop constraint if exists notifications_user_id_users_fkey;
alter table public.notifications add constraint notifications_user_id_users_fkey foreign key (user_id) references public.users(id) on delete cascade;

drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();

comment on table public.profiles is 'Legacy Supabase Auth profile table. Brandon RV application accounts are stored in public.users.';
