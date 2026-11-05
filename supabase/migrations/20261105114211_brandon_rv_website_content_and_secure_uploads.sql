
alter table public.appointments
  add column if not exists vehicle_id uuid references public.vehicles(id) on delete set null,
  add column if not exists service_id uuid references public.services(id) on delete set null,
  add column if not exists preferred_start timestamptz,
  add column if not exists preferred_end timestamptz;

create table public.enquiry_attachments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  enquiry_id uuid not null references public.enquiries(id) on delete cascade,
  uploaded_by uuid references auth.users(id) on delete set null,
  storage_path text not null unique,
  file_name text not null,
  mime_type text not null,
  size_bytes bigint,
  created_at timestamptz not null default now()
);
alter table public.enquiry_attachments enable row level security;
grant select, insert, delete on public.enquiry_attachments to authenticated;

create policy "customers view own enquiry attachments" on public.enquiry_attachments
for select to authenticated using (
  exists (select 1 from public.enquiries e where e.id = enquiry_id and e.user_id = (select auth.uid()))
);
create policy "customers add attachments to own enquiries" on public.enquiry_attachments
for insert to authenticated with check (
  uploaded_by = (select auth.uid())
  and exists (select 1 from public.enquiries e where e.id = enquiry_id and e.user_id = (select auth.uid()))
);
create policy "staff manage enquiry attachments" on public.enquiry_attachments
for all to authenticated using (private.has_business_permission(business_id,'enquiries.manage'))
with check (private.has_business_permission(business_id,'enquiries.manage'));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('brandon-rv-private','brandon-rv-private',false,10485760,array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do nothing;

create policy "customers upload own enquiry files" on storage.objects
for insert to authenticated with check (
  bucket_id = 'brandon-rv-private'
  and exists (
    select 1 from public.enquiries e
    where e.id::text = (storage.foldername(name))[2]
      and e.user_id = (select auth.uid())
      and e.business_id::text = (storage.foldername(name))[1]
  )
);
create policy "customers read own enquiry files" on storage.objects
for select to authenticated using (
  bucket_id = 'brandon-rv-private'
  and exists (
    select 1 from public.enquiries e
    where e.id::text = (storage.foldername(name))[2]
      and e.user_id = (select auth.uid())
      and e.business_id::text = (storage.foldername(name))[1]
  )
);
create policy "staff access business files" on storage.objects
for all to authenticated using (
  bucket_id = 'brandon-rv-private'
  and exists (
    select 1 from public.businesses b
    where b.id::text = (storage.foldername(name))[1]
      and private.is_business_member(b.id)
  )
) with check (
  bucket_id = 'brandon-rv-private'
  and exists (
    select 1 from public.businesses b
    where b.id::text = (storage.foldername(name))[1]
      and private.has_business_permission(b.id,'documents.manage')
  )
);

insert into public.site_pages (business_id,slug,title,content,is_published,sort_order)
select b.id, p.slug, p.title, p.content::jsonb, false, p.sort_order
from public.businesses b
cross join (values
 ('home','Home','{"hero_title":"Brandon RV","hero_subtitle":"From Factory Experience to Repairs On The Go","intro":"Mobile caravan and motorhome interior repairs and suitable accessory work around Tamworth NSW.","primary_action":"Request a quote","publication_note":"Draft content — owner approval required"}',1),
 ('about','About Brandon RV','{"intro":"A mobile caravan and motorhome interior repair and accessory service based in Tamworth NSW.","publication_note":"Verify experience and qualification wording before publication"}',2),
 ('services','Services','{"intro":"Only services approved by the owner and confirmed as within legal, insurance and competency requirements should be published."}',3),
 ('service-areas','Service Areas','{"base":"Tamworth NSW","proposed_radius_km":20,"publication_note":"Proposed radius only — validate before publication"}',4),
 ('how-it-works','How It Works','{"steps":["Submit an enquiry and vehicle details","Brandon RV reviews the request","Receive a quote or inspection proposal","Approve the scope and any parts costs","Appointment is confirmed","Work is completed and checked","Invoice and payment"]}',5),
 ('gallery','Previous Work','{"publication_note":"Only genuine work photographs with customer permission may be published."}',6),
 ('faq','Frequently Asked Questions','{"items":[]}',7),
 ('contact','Contact','{"phone":"0407 189 087","email":"enquires@brandonrv.com.au","publication_note":"Verify email spelling and mailbox before publication"}',8)
) as p(slug,title,content,sort_order)
on conflict (business_id,slug) do nothing;

insert into public.services (business_id,name,slug,category,description,scope_notes,is_active,is_published,sort_order)
select b.id,s.name,s.slug,s.category,s.description,s.scope_notes,true,false,s.sort_order
from public.businesses b
cross join (values
 ('Minor cabinetry and interior hardware','minor-cabinetry-interior-hardware','Launch candidate','Minor non-structural repairs involving suitable hinges, latches, runners, doors and trims.','Assess substrate and hidden damage; decline structural or major water-damage work.',1),
 ('Living-area accessories and fittings','living-area-accessories-fittings','Launch candidate','Suitable interior handles, fittings and accessories installed using an approved method.','Confirm product suitability, competency, manufacturer instructions and insurance before accepting work.',2),
 ('12V and 24V accessories','12v-24v-accessories','Conditional','Selected low-voltage accessory work only after task-specific review.','Do not publish or accept until wiring scope, competency and insurance requirements are confirmed.',3),
 ('Water pumps, taps and fittings','water-systems','Conditional','Selected water-system components and minor repairs subject to scope review.','Confirm plumbing and licensing requirements before advertising or accepting work.',4),
 ('Awnings and selected insurance work','awnings-insurance-work','Later / selected','Potential later service subject to job-specific assessment.','Requires verified competence, access/lifting/weather controls, insurance cover and insurer authority where applicable.',5)
) as s(name,slug,category,description,scope_notes,sort_order)
on conflict (business_id,slug) do nothing;

create index if not exists appointments_vehicle_id_idx on public.appointments(vehicle_id);
create index if not exists appointments_service_id_idx on public.appointments(service_id);
create index if not exists enquiry_attachments_enquiry_id_idx on public.enquiry_attachments(enquiry_id);
create index if not exists enquiry_attachments_business_id_idx on public.enquiry_attachments(business_id);
