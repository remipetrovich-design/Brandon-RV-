alter table public.users drop constraint if exists users_primary_group_check;
alter table public.users add constraint users_primary_group_check check(primary_group in ('customer','staff'));
alter table public.users drop constraint if exists users_secondary_group_check;
alter table public.users add constraint users_secondary_group_check check(secondary_group is null or secondary_group in ('customer','staff'));
