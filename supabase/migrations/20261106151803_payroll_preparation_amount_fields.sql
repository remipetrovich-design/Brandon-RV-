ALTER TABLE public.payroll_items
 ADD COLUMN IF NOT EXISTS tax_withheld numeric(12,2) NOT NULL DEFAULT 0,
 ADD COLUMN IF NOT EXISTS superannuation_amount numeric(12,2) NOT NULL DEFAULT 0,
 ADD COLUMN IF NOT EXISTS net_amount numeric(12,2) NOT NULL DEFAULT 0;
ALTER TABLE public.payroll_items
 ADD CONSTRAINT payroll_items_tax_nonnegative CHECK (tax_withheld >= 0),
 ADD CONSTRAINT payroll_items_super_nonnegative CHECK (superannuation_amount >= 0),
 ADD CONSTRAINT payroll_items_net_nonnegative CHECK (net_amount >= 0);
