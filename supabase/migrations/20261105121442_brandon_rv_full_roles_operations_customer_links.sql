-- Applied to Brandon RV Supabase project on 2026-11-05.
-- Customer ownership links, role presets and employee operations tables.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['customers','enquiries','quotes','appointments','jobs','invoices','documents'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname=t||'_user_id_users_fkey' AND conrelid=format('public.%I',t)::regclass) THEN
      EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL',t,t||'_user_id_users_fkey');
    END IF;
  END LOOP;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS customers_business_user_unique ON public.customers(business_id,user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS enquiries_user_created_idx ON public.enquiries(user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS quotes_user_created_idx ON public.quotes(user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS appointments_user_created_idx ON public.appointments(user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS jobs_user_created_idx ON public.jobs(user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS invoices_user_created_idx ON public.invoices(user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS documents_user_created_idx ON public.documents(user_id,created_at DESC);
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'normal' CHECK(priority IN ('low','normal','high','urgent'));
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS customer_approval_required boolean NOT NULL DEFAULT false;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS actual_start timestamptz;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS actual_end timestamptz;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS estimated_hours numeric(8,2);
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS actual_hours numeric(8,2);
CREATE TABLE IF NOT EXISTS public.job_assignments(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,staff_id uuid NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,assigned_by uuid REFERENCES public.users(id) ON DELETE SET NULL,assignment_role text NOT NULL DEFAULT 'technician',status text NOT NULL DEFAULT 'assigned' CHECK(status IN ('assigned','accepted','declined','completed','removed')),assigned_at timestamptz NOT NULL DEFAULT now(),UNIQUE(job_id,staff_id));
CREATE TABLE IF NOT EXISTS public.job_tasks(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,title text NOT NULL,description text,assigned_staff_id uuid REFERENCES public.staff(id) ON DELETE SET NULL,status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','in_progress','blocked','completed','cancelled')),due_at timestamptz,completed_at timestamptz,sort_order integer NOT NULL DEFAULT 0,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.time_entries(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,job_id uuid REFERENCES public.jobs(id) ON DELETE SET NULL,staff_id uuid NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,entry_type text NOT NULL DEFAULT 'work' CHECK(entry_type IN ('work','travel','break','admin')),started_at timestamptz NOT NULL,ended_at timestamptz,duration_minutes integer CHECK(duration_minutes IS NULL OR duration_minutes>=0),notes text,approved_by uuid REFERENCES public.users(id) ON DELETE SET NULL,approved_at timestamptz,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.availability_blocks(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,staff_id uuid REFERENCES public.staff(id) ON DELETE CASCADE,starts_at timestamptz NOT NULL,ends_at timestamptz NOT NULL,block_type text NOT NULL CHECK(block_type IN ('leave','unavailable','training','business_closed')),reason text,status text NOT NULL DEFAULT 'approved' CHECK(status IN ('pending','approved','declined')),created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,created_at timestamptz NOT NULL DEFAULT now(),CHECK(ends_at>starts_at));
CREATE TABLE IF NOT EXISTS public.suppliers(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,name text NOT NULL,contact_name text,email text,phone text,account_reference text,website text,notes text,is_active boolean NOT NULL DEFAULT true,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.supplier_orders(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE RESTRICT,job_id uuid REFERENCES public.jobs(id) ON DELETE SET NULL,order_number text,status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','ordered','part_received','received','cancelled')),ordered_at timestamptz,expected_at date,received_at timestamptz,subtotal numeric(12,2) NOT NULL DEFAULT 0,tax_amount numeric(12,2) NOT NULL DEFAULT 0,total numeric(12,2) NOT NULL DEFAULT 0,notes text,created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.supplier_order_items(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),order_id uuid NOT NULL REFERENCES public.supplier_orders(id) ON DELETE CASCADE,description text NOT NULL,sku text,quantity numeric(12,3) NOT NULL DEFAULT 1 CHECK(quantity>0),unit_cost numeric(12,2) NOT NULL DEFAULT 0,tax_rate numeric(5,2) NOT NULL DEFAULT 0,line_total numeric(12,2) NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS public.expenses(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,job_id uuid REFERENCES public.jobs(id) ON DELETE SET NULL,supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,category text NOT NULL,description text NOT NULL,amount_ex_tax numeric(12,2) NOT NULL DEFAULT 0,tax_amount numeric(12,2) NOT NULL DEFAULT 0,total numeric(12,2) NOT NULL DEFAULT 0,expense_date date NOT NULL DEFAULT CURRENT_DATE,receipt_storage_path text,entered_by uuid REFERENCES public.users(id) ON DELETE SET NULL,approved_by uuid REFERENCES public.users(id) ON DELETE SET NULL,approved_at timestamptz,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.customer_messages(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,job_id uuid REFERENCES public.jobs(id) ON DELETE SET NULL,enquiry_id uuid REFERENCES public.enquiries(id) ON DELETE SET NULL,quote_id uuid REFERENCES public.quotes(id) ON DELETE SET NULL,sender_type text NOT NULL CHECK(sender_type IN ('customer','staff','system')),sender_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,message text NOT NULL,is_internal boolean NOT NULL DEFAULT false,read_at timestamptz,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.notification_preferences(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,category text NOT NULL,email_enabled boolean NOT NULL DEFAULT true,in_app_enabled boolean NOT NULL DEFAULT true,updated_at timestamptz NOT NULL DEFAULT now(),UNIQUE(user_id,category));
CREATE TABLE IF NOT EXISTS public.email_verification_tokens(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,token_hash text NOT NULL UNIQUE,expires_at timestamptz NOT NULL,used_at timestamptz,created_at timestamptz NOT NULL DEFAULT now());
INSERT INTO public.permissions(permission_key,description) VALUES
('customers.view','View customer records'),('customers.manage','Create and update customer records'),('vehicles.view','View customer vehicles'),('vehicles.manage','Manage customer vehicles'),('enquiries.view','View service enquiries'),('enquiries.manage','Manage service enquiries'),('quotes.view','View quotes'),('quotes.manage','Create and update quotes'),('quotes.approve','Approve and issue quotes'),('appointments.view','View appointments'),('appointments.manage','Manage appointments and scheduling'),('jobs.view','View jobs'),('jobs.manage','Manage jobs and work scopes'),('jobs.assign','Assign staff to jobs'),('jobs.complete','Complete job tasks and status'),('time.view','View staff time entries'),('time.manage','Manage and approve time entries'),('invoices.view','View invoices'),('invoices.manage','Create and manage invoices'),('payments.manage','Record payments'),('expenses.view','View expenses'),('expenses.manage','Manage and approve expenses'),('suppliers.view','View suppliers'),('suppliers.manage','Manage suppliers and purchase orders'),('staff.view','View staff records'),('staff.manage','Manage staff accounts and invitations'),('roles.manage','Manage roles and permissions'),('website.manage','Manage website content and settings'),('reports.view','View business reports'),('settings.manage','Manage business settings'),('documents.view','View permitted documents'),('documents.manage','Manage business documents'),('communications.manage','Manage customer communications')
ON CONFLICT(permission_key) DO NOTHING;
DO $$
DECLARE b uuid; g uuid; r text; p text[];
BEGIN
 SELECT id INTO b FROM public.businesses WHERE slug='brandon-rv' LIMIT 1;
 IF b IS NULL THEN RAISE EXCEPTION 'Brandon RV business record missing'; END IF;
 FOREACH r IN ARRAY ARRAY['owner','administrator','manager','technician','office','accounts'] LOOP
  INSERT INTO public.permission_groups(business_id,name,description,is_system) SELECT b,initcap(r),'System role preset: '||r,true WHERE NOT EXISTS(SELECT 1 FROM public.permission_groups WHERE business_id=b AND lower(name)=r);
  SELECT id INTO g FROM public.permission_groups WHERE business_id=b AND lower(name)=r LIMIT 1;
  p := CASE r WHEN 'owner' THEN ARRAY(SELECT permission_key FROM public.permissions)
  WHEN 'administrator' THEN ARRAY(SELECT permission_key FROM public.permissions WHERE permission_key<>'roles.manage')
  WHEN 'manager' THEN ARRAY['customers.view','customers.manage','vehicles.view','vehicles.manage','enquiries.view','enquiries.manage','quotes.view','quotes.manage','appointments.view','appointments.manage','jobs.view','jobs.manage','jobs.assign','jobs.complete','time.view','time.manage','invoices.view','expenses.view','expenses.manage','suppliers.view','suppliers.manage','staff.view','reports.view','documents.view','documents.manage','communications.manage']
  WHEN 'technician' THEN ARRAY['vehicles.view','enquiries.view','appointments.view','jobs.view','jobs.complete','documents.view']
  WHEN 'office' THEN ARRAY['customers.view','customers.manage','vehicles.view','vehicles.manage','enquiries.view','enquiries.manage','quotes.view','appointments.view','appointments.manage','jobs.view','invoices.view','documents.view','communications.manage']
  ELSE ARRAY['customers.view','quotes.view','invoices.view','payments.manage','expenses.view','reports.view','documents.view'] END;
  INSERT INTO public.permission_group_permissions(group_id,permission_key) SELECT g,unnest(p) ON CONFLICT DO NOTHING;
 END LOOP;
END $$;
ALTER TABLE public.job_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.availability_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_verification_tokens ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.job_assignments,public.job_tasks,public.time_entries,public.availability_blocks,public.suppliers,public.supplier_orders,public.supplier_order_items,public.expenses,public.customer_messages,public.notification_preferences,public.email_verification_tokens FROM anon,authenticated;
GRANT ALL ON public.job_assignments,public.job_tasks,public.time_entries,public.availability_blocks,public.suppliers,public.supplier_orders,public.supplier_order_items,public.expenses,public.customer_messages,public.notification_preferences,public.email_verification_tokens TO service_role;
