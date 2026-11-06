-- Horilla-inspired workforce modules on Brandon RV's existing customer identity.
CREATE TABLE IF NOT EXISTS public.staff_invitations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
 email text NOT NULL, user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
 role_key text NOT NULL REFERENCES public.user_roles(role_key), job_title text,
 employment_type text NOT NULL DEFAULT 'full_time' CHECK (employment_type IN ('casual','part_time','full_time')),
 start_date date, invited_by uuid NOT NULL REFERENCES public.users(id), token_hash text NOT NULL UNIQUE,
 expires_at timestamptz NOT NULL, accepted_at timestamptz, revoked_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS staff_invitations_business_email_idx ON public.staff_invitations(business_id,lower(email));
CREATE TABLE IF NOT EXISTS public.hr_onboarding_tasks (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE, title text NOT NULL, description text, due_date date,
 completed_at timestamptz, completed_by uuid REFERENCES public.users(id), sort_order integer NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.attendance_entries (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE, clock_in timestamptz NOT NULL, clock_out timestamptz,
 break_minutes integer NOT NULL DEFAULT 0 CHECK (break_minutes BETWEEN 0 AND 1440), notes text,
 approved_by uuid REFERENCES public.users(id), approved_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
 CHECK (clock_out IS NULL OR clock_out > clock_in)
);
CREATE INDEX IF NOT EXISTS attendance_entries_business_user_idx ON public.attendance_entries(business_id,user_id,clock_in DESC);
CREATE TABLE IF NOT EXISTS public.leave_types (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
 name text NOT NULL, paid boolean NOT NULL DEFAULT true, annual_entitlement_days numeric(6,2), is_active boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (business_id,name)
);
CREATE TABLE IF NOT EXISTS public.leave_balances (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE, leave_type_id uuid NOT NULL REFERENCES public.leave_types(id) ON DELETE CASCADE,
 opening_balance_days numeric(8,2) NOT NULL DEFAULT 0, accrued_days numeric(8,2) NOT NULL DEFAULT 0,
 used_days numeric(8,2) NOT NULL DEFAULT 0, updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(user_id,leave_type_id)
);
CREATE TABLE IF NOT EXISTS public.leave_requests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE, leave_type_id uuid NOT NULL REFERENCES public.leave_types(id),
 start_date date NOT NULL, end_date date NOT NULL, days numeric(6,2) NOT NULL CHECK (days > 0), reason text,
 status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','cancelled')),
 reviewed_by uuid REFERENCES public.users(id), reviewed_at timestamptz, reviewer_note text, created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(end_date >= start_date)
);
CREATE INDEX IF NOT EXISTS leave_requests_business_dates_idx ON public.leave_requests(business_id,start_date,end_date,status);
CREATE TABLE IF NOT EXISTS public.employee_assets (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE, asset_name text NOT NULL, asset_tag text,
 serial_number text, assigned_at date NOT NULL DEFAULT current_date, returned_at date, condition_notes text, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.payroll_periods (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
 name text NOT NULL, period_start date NOT NULL, period_end date NOT NULL, pay_date date,
 status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','review','approved','exported','paid','void')),
 notes text, created_by uuid REFERENCES public.users(id), approved_by uuid REFERENCES public.users(id), approved_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(), CHECK(period_end >= period_start), UNIQUE(business_id,period_start,period_end)
);
CREATE TABLE IF NOT EXISTS public.payroll_items (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
 payroll_period_id uuid NOT NULL REFERENCES public.payroll_periods(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE, ordinary_hours numeric(8,2) NOT NULL DEFAULT 0,
 overtime_hours numeric(8,2) NOT NULL DEFAULT 0, allowances numeric(12,2) NOT NULL DEFAULT 0,
 deductions numeric(12,2) NOT NULL DEFAULT 0, gross_amount numeric(12,2) NOT NULL DEFAULT 0, notes text, created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(payroll_period_id,user_id), CHECK(ordinary_hours >= 0 AND overtime_hours >= 0 AND allowances >= 0 AND deductions >= 0 AND gross_amount >= 0)
);
INSERT INTO public.permissions(permission_key,description) VALUES
 ('leave.view','View leave balances and requests'),('leave.manage','Manage and approve leave'),
 ('assets.view','View employee assets'),('assets.manage','Manage employee asset allocations'),
 ('payroll.view','View payroll preparation'),('payroll.manage','Manage and approve payroll preparation'),
 ('onboarding.view','View onboarding tasks'),('onboarding.manage','Manage onboarding tasks')
ON CONFLICT(permission_key) DO NOTHING;
INSERT INTO public.user_role_permissions(role_key,permission_key)
SELECT r.role_key,p.permission_key FROM public.user_roles r CROSS JOIN public.permissions p
WHERE (r.role_key IN ('owner','website_developer','administrator','manager') AND p.permission_key IN ('leave.view','leave.manage','assets.view','assets.manage','payroll.view','payroll.manage','onboarding.view','onboarding.manage'))
 OR (r.role_key='supervisor' AND p.permission_key IN ('leave.view','leave.manage','assets.view','onboarding.view','onboarding.manage'))
 OR (r.role_key='accounts' AND p.permission_key IN ('payroll.view','payroll.manage'))
 OR (r.role_key IN ('technician','worker','senior_worker','apprentice','office') AND p.permission_key IN ('leave.view','assets.view','onboarding.view'))
ON CONFLICT DO NOTHING;
ALTER TABLE public.staff_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_onboarding_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_items ENABLE ROW LEVEL SECURITY;
