-- Extend the editable Brandon RV catalogue without changing existing records.
alter table public.services
  add column if not exists price_from numeric(12,2),
  add column if not exists pricing_label text;

alter table public.service_areas
  add column if not exists suburbs text[] not null default '{}',
  add column if not exists postcodes text[] not null default '{}',
  add column if not exists updated_at timestamptz not null default now();

comment on column public.services.price_from is 'Optional starting price in AUD; null means quote on request.';
comment on column public.services.pricing_label is 'Optional customer-facing pricing note, e.g. From $120 or Quote required.';
