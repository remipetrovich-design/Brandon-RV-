-- Connect service presets and actual Workcard costing to quote and invoice lines.
-- Additive migration: existing records remain valid and are treated as custom/unpriced entries.
alter table public.quote_items
  add column if not exists service_id uuid references public.services(id) on delete set null;

alter table public.job_work_entries
  add column if not exists quantity_required numeric(12,2) not null default 0,
  add column if not exists quantity_used numeric(12,2) not null default 0,
  add column if not exists cost_unit_price numeric(12,2) not null default 0,
  add column if not exists part_number text,
  add column if not exists supplier_name text,
  add column if not exists invoiceable boolean not null default false,
  add column if not exists service_id uuid references public.services(id) on delete set null;

-- Preserve legacy quantity values as actual usage when no explicit usage was recorded.
update public.job_work_entries
set quantity_used = quantity
where quantity_used = 0 and quantity > 0;

-- Legacy entries remain excluded from invoices until reviewed and explicitly marked invoiceable.
create index if not exists quote_items_service_id_idx on public.quote_items(service_id);
create index if not exists job_work_entries_service_id_idx on public.job_work_entries(service_id);
create index if not exists job_work_entries_invoiceable_job_idx
  on public.job_work_entries(business_id, job_id, invoiceable)
  where invoiceable = true;

comment on column public.job_work_entries.quantity_required is 'Quantity requested or planned for the Workcard; not automatically invoiced.';
comment on column public.job_work_entries.quantity_used is 'Actual quantity consumed or labour hours performed.';
comment on column public.job_work_entries.cost_unit_price is 'Actual business cost per unit, excluding tax.';
comment on column public.job_work_entries.invoiceable is 'Explicitly approved for inclusion in the final invoice.';

-- Variation acceptance also creates planned Workcard entries. Carry the source
-- quote line's service and required quantity into those entries automatically.
create or replace function public.sync_workcard_entry_from_quote_line()
returns trigger
language plpgsql
set search_path=public
as $$
declare
  v_quantity numeric;
  v_service_id uuid;
begin
  if new.source_quote_item_id is not null then
    select quantity,service_id into v_quantity,v_service_id
      from public.quote_items where id=new.source_quote_item_id;
    if found then
      if new.quantity_required=0 then new.quantity_required:=v_quantity; end if;
      if new.service_id is null then new.service_id:=v_service_id; end if;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists job_work_entries_sync_quote_line on public.job_work_entries;
create trigger job_work_entries_sync_quote_line
before insert on public.job_work_entries
for each row execute function public.sync_workcard_entry_from_quote_line();
