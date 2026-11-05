import Link from "next/link";
import {notFound,redirect} from "next/navigation";
import {currentUser,currentMembership,database,userHasPermission} from "@/lib/auth";
import AdminRecordActions from "@/components/admin-record-actions";
import AdminJobTools from "@/components/admin-job-tools";
export const dynamic="force-dynamic";
const sections:any={
 enquiries:{title:"Service enquiries",permission:"enquiries.view",table:"enquiries",columns:"id,contact_name,email,phone,requested_service,status,location,created_at",fields:["contact_name","email","phone","requested_service","status","location","created_at"]},
 appointments:{title:"Appointments",permission:"appointments.view",table:"appointments",columns:"id,status,preferred_start,starts_at,ends_at,location,customer_notes,created_at",fields:["status","preferred_start","starts_at","ends_at","location","customer_notes","created_at"]},
 jobs:{title:"Jobs",permission:"jobs.view",table:"jobs",columns:"id,job_number,title,status,priority,scheduled_start,scheduled_end,customer_visible_notes,created_at",fields:["job_number","title","status","priority","scheduled_start","scheduled_end","customer_visible_notes"]},
 customers:{title:"Customers",permission:"customers.view",table:"customers",columns:"id,full_name,email,phone,suburb,state,postcode,status,created_at",fields:["full_name","email","phone","suburb","state","postcode","status"]},
 quotes:{title:"Quotes",permission:"quotes.view",table:"quotes",columns:"id,quote_number,status,issue_date,expiry_date,total,created_at",fields:["quote_number","status","issue_date","expiry_date","total","created_at"]},
 invoices:{title:"Invoices",permission:"invoices.view",table:"invoices",columns:"id,invoice_number,status,issue_date,due_date,total,amount_paid,created_at",fields:["invoice_number","status","issue_date","due_date","total","amount_paid"]},
 suppliers:{title:"Suppliers",permission:"suppliers.view",table:"suppliers",columns:"id,name,contact_name,email,phone,account_reference,is_active,created_at",fields:["name","contact_name","email","phone","account_reference","is_active"]},
 expenses:{title:"Expenses",permission:"expenses.view",table:"expenses",columns:"id,category,description,amount_ex_tax,tax_amount,total,expense_date,created_at",fields:["category","description","amount_ex_tax","tax_amount","total","expense_date"]},
 website:{title:"Website pages",permission:"website.manage",table:"site_pages",columns:"id,title,slug,is_published,updated_at",fields:["title","slug","is_published","updated_at"]},
 settings:{title:"Business settings",permission:"settings.manage",table:"business_settings",columns:"business_id,settings,updated_at",fields:["settings","updated_at"]}
};
const label=(v:string)=>v.replaceAll("_"," ").replace(/\b\w/g,x=>x.toUpperCase());
const format=(v:any)=>v===null||v===undefined?"—":typeof v==="boolean"?(v?"Yes":"No"):typeof v==="object"?JSON.stringify(v):typeof v==="string"&&v.includes("T")&&!Number.isNaN(Date.parse(v))?new Date(v).toLocaleString("en-AU"):String(v);
export default async function AdminSectionPage({params}:{params:Promise<{section:string}>}){
 const {section}=await params;const config=sections[section];if(!config)notFound();
 const user=await currentUser();if(!user)redirect("/portal/sign-in");
 const membership=await currentMembership(user.id);if(!membership)redirect("/staff");
 if(!(await userHasPermission(user.id,config.permission)))redirect("/admin");
 const db=database();let rows:any[]=[];
 if(section==="settings"){
  const {data}=await db.from(config.table).select(config.columns).eq("business_id",membership.business_id).maybeSingle();if(data)rows=[data];
 }else{
  const {data,error}=await db.from(config.table).select(config.columns).eq("business_id",membership.business_id).order("created_at",{ascending:false}).limit(100);
  if(error)throw new Error("Could not load "+section+" records.");rows=data??[];
 }
 return <main className="portal-page"><header className="portal-topbar"><div className="shell portal-topbar-inner"><strong>BRANDON RV · ADMIN</strong><div className="portal-topbar-right"><span>{membership.role}</span><Link href="/admin">Operations dashboard</Link></div></div></header>
 <div className="shell portal-shell" style={{display:"block",maxWidth:1180}}><div className="portal-page-heading"><p className="eyebrow"><span className="eyebrow-line"/> BUSINESS OPERATIONS</p><h1>{config.title}.</h1><p>Live records from the Brandon RV business database.</p></div>
 <section className="portal-panel"><div className="portal-panel-heading"><div><span className="panel-kicker">{rows.length} RECORDS</span><h2>{config.title}</h2></div></div>
 {rows.length?<div className="activity-list">{rows.map((row:any,i:number)=><article className="activity-item" key={row.id??row.business_id??i}><div className="activity-date">{format(row.created_at??row.updated_at??row.issue_date??row.expense_date??row.starts_at)}</div><div className="activity-copy"><strong>{row.title??row.full_name??row.name??row.job_number??row.quote_number??row.invoice_number??row.contact_name??row.category??"Business record"}</strong><span>{config.fields.filter((f:string)=>!["created_at","updated_at","title","full_name","name","job_number","quote_number","invoice_number","contact_name"].includes(f)).map((f:string)=>label(f)+": "+format(row[f])).join(" · ")}</span></div><AdminRecordActions section={section} id={row.id} status={row.status} isActive={row.is_active} isPublished={row.is_published} startsAt={row.starts_at} endsAt={row.ends_at} preferredStart={row.preferred_start}/>{section==="jobs"&&<AdminJobTools jobId={row.id}/>}</article>)}</div>:<p className="panel-footnote">No {config.title.toLowerCase()} have been recorded yet.</p>}</section>
 <p className="portal-muted-note">Status changes are permission-checked and recorded in the business audit history.</p></div></main>;
}