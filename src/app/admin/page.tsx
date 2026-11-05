import { redirect } from "next/navigation";
import Link from "next/link";
import { currentUser,currentMembership,database,userHasPermission } from "@/lib/auth";
export const dynamic="force-dynamic";
export default async function AdminDashboard(){
 const user=await currentUser(); if(!user) redirect("/portal/sign-in");
 const membership=await currentMembership(user.id); if(!membership) redirect("/staff");
 const permissions=["customers.view","enquiries.view","quotes.view","appointments.view","jobs.view","invoices.view","expenses.view","suppliers.view","staff.view","website.manage","reports.view","settings.manage"];
 const allowed=await Promise.all(permissions.map(p=>userHasPermission(user.id,p)));
 if(!allowed.some(Boolean)) redirect("/staff");
 const can=(p:string)=>permissions.indexOf(p)>=0&&allowed[permissions.indexOf(p)];
 const db=database(); const business=membership.business_id;
 const counts=await Promise.all([
  can("enquiries.view")?db.from("enquiries").select("id",{count:"exact",head:true}).eq("business_id",business):Promise.resolve({count:null}),
  can("appointments.view")?db.from("appointments").select("id",{count:"exact",head:true}).eq("business_id",business).in("status",["requested","confirmed","rescheduled"]):Promise.resolve({count:null}),
  can("jobs.view")?db.from("jobs").select("id",{count:"exact",head:true}).eq("business_id",business).not("status","in","(completed,cancelled)"):Promise.resolve({count:null}),
  can("quotes.view")?db.from("quotes").select("id",{count:"exact",head:true}).eq("business_id",business).eq("status","sent"):Promise.resolve({count:null})
 ]);
 const links=[
  ["Enquiries","/admin/enquiries","Review new service requests","enquiries.view"],
  ["Appointments","/admin/appointments","Manage requests and calendar","appointments.view"],
  ["Jobs","/admin/jobs","Work scopes, assignments and status","jobs.view"],
  ["Customers","/admin/customers","Customer records and vehicles","customers.view"],
  ["Quotes","/admin/quotes","Prepare and issue quotes","quotes.view"],
  ["Invoices","/admin/invoices","Billing and payment records","invoices.view"],
  ["Staff","/admin/staff","Invitations and employee access","staff.view"],
  ["Suppliers & parts","/admin/suppliers","Supplier directory and orders","suppliers.view"],
  ["Expenses","/admin/expenses","Business expenses and receipts","expenses.view"],
  ["Website editor","/admin/website","Edit public website content","website.manage"],
  ["Reports","/admin/reports","Business and job reporting","reports.view"],
  ["Settings","/admin/settings","Business configuration","settings.manage"]
 ] as const;
 return <main className="portal-page"><header className="portal-topbar"><div className="shell portal-topbar-inner"><strong>BRANDON RV · ADMIN</strong><div className="portal-topbar-right"><span>{user.full_name} · {membership.role}</span><Link href="/staff">Staff workspace</Link></div></div></header>
 <div className="shell portal-shell" style={{display:"block",maxWidth:1180}}><div className="portal-welcome"><div><p className="eyebrow"><span className="eyebrow-line"/> BUSINESS CONTROL CENTRE</p><h1>Operations <em>overview.</em></h1><p>Live business records. No demo totals or sample jobs.</p></div></div>
 <div className="portal-stat-grid"><article><span>ENQUIRIES</span><strong>{counts[0].count??"—"}</strong><small>All service requests</small></article><article><span>UPCOMING BOOKINGS</span><strong>{counts[1].count??"—"}</strong><small>Requested and confirmed</small></article><article><span>OPEN JOBS</span><strong>{counts[2].count??"—"}</strong><small>Active work queue</small></article><article><span>QUOTES TO RESPOND</span><strong>{counts[3].count??"—"}</strong><small>Quotes awaiting customer</small></article></div>
 <div className="portal-shortcuts">{links.filter(x=>can(x[3])).map(x=><Link href={x[1]} key={x[1]}><span>▦</span><strong>{x[0]}</strong><small>{x[2]}</small><b>→</b></Link>)}</div></div></main>;
}