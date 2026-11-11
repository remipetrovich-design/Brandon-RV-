import "server-only";
import {unstable_cache} from "next/cache";
import {database} from "@/lib/auth";

type BusinessSummary={name:string;status:string|null;city:string|null;region:string|null}|null;
type DashboardSnapshot={
 counts:{enquiries:number|null;appointments:number|null;jobs:number|null;quotes:number|null;invoices:number|null;supplierOrders:number|null};
 business:BusinessSummary;
};

const readDashboardSnapshot=unstable_cache(async(businessId:string):Promise<DashboardSnapshot>=>{
 const db=database();
 const [enquiries,appointments,jobs,quotes,invoices,supplierOrders,businessResult]=await Promise.all([
  db.from("enquiries").select("id",{count:"exact",head:true}).eq("business_id",businessId),
  db.from("appointments").select("id",{count:"exact",head:true}).eq("business_id",businessId).in("status",["requested","confirmed","rescheduled"]),
  db.from("jobs").select("id",{count:"exact",head:true}).eq("business_id",businessId).not("status","in","(completed,cancelled)"),
  db.from("quotes").select("id",{count:"exact",head:true}).eq("business_id",businessId).eq("status","sent"),
  db.from("invoices").select("id",{count:"exact",head:true}).eq("business_id",businessId),
  db.from("supplier_orders").select("id",{count:"exact",head:true}).eq("business_id",businessId).in("status",["draft","ordered","part_received"]),
  db.from("businesses").select("name,status,city,region").eq("id",businessId).maybeSingle()
 ]);
 return {
  counts:{enquiries:enquiries.count??null,appointments:appointments.count??null,jobs:jobs.count??null,quotes:quotes.count??null,invoices:invoices.count??null,supplierOrders:supplierOrders.count??null},
  business:businessResult.data??null
 };
},["brv-admin-dashboard-snapshot-v1"],{revalidate:20,tags:["brv-admin-dashboard"]});

export async function getAdminDashboardSnapshot(businessId:string){return readDashboardSnapshot(businessId);}
