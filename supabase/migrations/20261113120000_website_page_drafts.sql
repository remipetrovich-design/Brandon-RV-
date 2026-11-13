alter table public.site_pages
  add column if not exists draft_title text,
  add column if not exists draft_content jsonb,
  add column if not exists draft_meta_title text,
  add column if not exists draft_meta_description text,
  add column if not exists draft_updated_at timestamptz;

comment on column public.site_pages.draft_content is
  'Unpublished website-builder content. Public pages continue to read content until an authorised publish action copies the draft into the live fields.';
