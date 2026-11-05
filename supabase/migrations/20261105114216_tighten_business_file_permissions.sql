
drop policy if exists "staff access business files" on storage.objects;
create policy "staff access business files" on storage.objects
for all to authenticated using (
  bucket_id = 'brandon-rv-private'
  and exists (
    select 1 from public.businesses b
    where b.id::text = (storage.foldername(name))[1]
      and (
        private.has_business_permission(b.id,'documents.manage')
        or private.has_business_permission(b.id,'enquiries.manage')
      )
  )
) with check (
  bucket_id = 'brandon-rv-private'
  and exists (
    select 1 from public.businesses b
    where b.id::text = (storage.foldername(name))[1]
      and (
        private.has_business_permission(b.id,'documents.manage')
        or private.has_business_permission(b.id,'enquiries.manage')
      )
  )
);
