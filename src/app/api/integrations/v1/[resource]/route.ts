import { authenticateIntegration, auditIntegrationRequest } from "@/lib/integration-auth";
import { database } from "@/lib/auth";
export const runtime = "nodejs";

const RESOURCES: Record<string, { table: string; scope: string; columns: string; filters?: Record<string,string>; sensitive?: boolean; tenantColumn?: string }> = {
  business: { table: "businesses", scope: "business.read", tenantColumn: "id", columns: "id,name,slug,brand_line,phone,public_email,city,region,country,status,created_at,updated_at" },
  services: { table: "services", scope: "services.read", columns: "id,name,slug,category,description,scope_notes,is_active,is_published,sort_order,created_at,updated_at" },
  "service-areas": { table: "service_areas", scope: "service_areas.read", columns: "id,name,description,radius_km,travel_fee,is_published,sort_order,created_at" },
  customers: { table: "customers", scope: "customers.read", columns: "id,full_name,email,phone,address,suburb,state,postcode,status,created_at,updated_at" },
  vehicles: { table: "vehicles", scope: "vehicles.read", columns: "id,customer_id,make,model,year,vehicle_type,registration,vin,notes,created_at,updated_at" },
  enquiries: { table: "enquiries", scope: "enquiries.read", columns: "id,request_number,request_type,customer_id,contact_name,email,phone,location,vehicle_description,requested_service,description,status,stage,source,created_at,updated_at" },
  quotes: { table: "quotes", scope: "quotes.read", columns: "id,quote_number,revision_number,status,issue_date,expiry_date,subtotal,tax_amount,total,notes,terms,customer_id,enquiry_id,job_id,created_at,updated_at" },
  appointments: { table: "appointments", scope: "appointments.read", columns: "id,customer_id,enquiry_id,quote_id,starts_at,ends_at,preferred_start,preferred_end,location,status,customer_notes,created_at,updated_at" },
  workcards: { table: "jobs", scope: "workcards.read", columns: "id,job_number,title,status,priority,customer_id,appointment_id,quote_id,scope_of_work,scheduled_start,scheduled_end,estimated_hours,actual_hours,customer_visible_notes,created_at,updated_at" },
  "work-entries": { table: "job_work_entries", scope: "work_entries.read", columns: "id,job_id,entry_type,description,quantity_required,quantity_used,part_number,supplier_name,cost_unit_price,unit_price,tax_rate,line_total,customer_visible,invoiceable,created_at" },
  parts: { table: "job_work_entries", scope: "parts.read", columns: "id,job_id,description,quantity_required,quantity_used,part_number,supplier_name,cost_unit_price,unit_price,tax_rate,line_total,customer_visible,invoiceable,created_at", filters: { entry_type: "parts" } },
  suppliers: { table: "suppliers", scope: "suppliers.read", columns: "id,name,contact_name,email,phone,account_reference,website,notes,is_active,created_at,updated_at" },
  "supplier-orders": { table: "supplier_orders", scope: "supplier_orders.read", columns: "id,supplier_id,job_id,order_number,status,ordered_at,expected_at,received_at,subtotal,tax_amount,total,notes,created_at,updated_at" },
  invoices: { table: "invoices", scope: "invoices.read", columns: "id,invoice_number,customer_id,job_id,quote_id,status,issue_date,due_date,subtotal,tax_amount,total,amount_paid,notes,created_at,updated_at" },
  expenses: { table: "expenses", scope: "expenses.read", columns: "id,job_id,supplier_id,category,description,amount_ex_tax,tax_amount,total,expense_date,created_at" },
  staff: { table: "users", scope: "staff.read", columns: "id,first_name,last_name,full_name,email,phone,status,user_role,employee_number,job_title,employment_type,employment_status,start_date,end_date,department,team_name,custom_title,created_at,updated_at", sensitive: true },
  "time-entries": { table: "attendance_entries", scope: "time_entries.read", columns: "id,user_id,clock_in,clock_out,break_minutes,notes,approved_by,approved_at,created_at", sensitive: true },
  leave: { table: "leave_requests", scope: "leave.read", columns: "id,user_id,leave_type_id,start_date,end_date,days,status,reason,reviewed_by,reviewed_at,reviewer_note,created_at", sensitive: true },
  payroll: { table: "payroll_items", scope: "payroll.read", columns: "id,payroll_period_id,user_id,ordinary_hours,overtime_hours,allowances,deductions,gross_amount,tax_withheld,superannuation_amount,net_amount,notes,created_at", sensitive: true },
  website: { table: "site_pages", scope: "website.read", columns: "id,slug,title,meta_title,meta_description,is_published,published_at,sort_order,updated_at" },
  "business-settings": { table: "business_settings", scope: "business.settings.read", columns: "business_id,settings,updated_at", sensitive: true },
  communications: { table: "customer_messages", scope: "communications.read", columns: "id,customer_id,user_id,job_id,enquiry_id,quote_id,sender_type,sender_user_id,message,is_internal,read_at,created_at" },
  tasks: { table: "job_tasks", scope: "tasks.read", columns: "id,job_id,title,description,assigned_staff_id,status,due_at,completed_at,sort_order,created_at,updated_at" },
  assets: { table: "employee_assets", scope: "assets.read", columns: "id,user_id,asset_name,asset_tag,serial_number,assigned_at,returned_at,condition_notes,created_at", sensitive: true },
  onboarding: { table: "hr_onboarding_tasks", scope: "onboarding.view", columns: "id,user_id,title,description,due_date,completed_at,completed_by,sort_order,created_at", sensitive: true },
};

export async function GET(request: Request, { params }: { params: Promise<{ resource: string }> }) {
  const { resource } = await params, config = RESOURCES[resource];
  if (!config) return Response.json({ error: { code: "RESOURCE_NOT_FOUND", message: "Unknown API resource." } }, { status: 404 });
  const auth = await authenticateIntegration(request, config.scope);
  if (auth.response) return auth.response;
  const context = auth.context!, url = new URL(request.url);
  const page = Math.max(1, Math.min(10000, Number(url.searchParams.get("page") || 1)));
  const pageSize = Math.max(1, Math.min(100, Number(url.searchParams.get("pageSize") || 25)));
  const id = url.searchParams.get("id");
  const db = database();
  let query = db.from(config.table).select(config.columns, { count: "exact" }).eq(config.tenantColumn ?? "business_id", context.businessId).order("created_at", { ascending: false }).range((page - 1) * pageSize, page * pageSize - 1);
  if (id) query = query.eq("id", id);
  if (resource === "staff") query = query.not("user_role", "is", null).neq("user_role", "customer");
  if (config.filters) for (const [field, value] of Object.entries(config.filters)) query = query.eq(field, value);
  const status = url.searchParams.get("status");
  if (status && /^[a-z_]{1,40}$/.test(status)) query = query.eq("status", status);
  if (config.sensitive && !context.credential.scopes.includes(config.scope)) {
    await auditIntegrationRequest(context, request, { status: 403, outcome: "denied", scope: config.scope });
    return Response.json({ error: { code: "INSUFFICIENT_SCOPE", message: "This integration cannot access this resource." } }, { status: 403 });
  }
  const { data, error, count } = await query;
  if (error) {
    await auditIntegrationRequest(context, request, { status: 500, outcome: "error", scope: config.scope, action: "resource.read" });
    return Response.json({ error: { code: "RESOURCE_QUERY_FAILED", message: "Could not retrieve this resource." }, requestId: context.requestId }, { status: 500 });
  }
  await auditIntegrationRequest(context, request, { status: 200, outcome: "success", scope: config.scope, action: "resource.read", details: { resource, returned: data?.length ?? 0 } });
  return Response.json({ data: data ?? [], pagination: { page, pageSize, totalItems: count ?? 0, totalPages: Math.ceil((count ?? 0) / pageSize) }, requestId: context.requestId }, { headers: { "X-Request-Id": context.requestId } });
}
