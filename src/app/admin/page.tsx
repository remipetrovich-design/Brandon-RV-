import {redirect} from "next/navigation";
import Link from "next/link";
import {currentUser,currentMembership,database,userHasPermission} from "@/lib/auth";
export const dynamic="force-dynamic";
const menuGroups=[
 {title:"Customers & vehicles",description:"Customer records and incoming service requests.",items:[
  ["Customers","/admin/customers","Customer profiles and service history","customers.view"],
  ["Vehicles","/admin/vehicles","Caravan and motorhome register","vehicles.view"],
  ["Enquiries","/admin/enquiries","New website and customer requests","enquiries.view"]
 ]},
 {title:"Bookings & work orders",description:"Move approved work from quote through to completion.",items:[
  ["Appointments & calendar","/admin/appointments","Requested visits and confirmed bookings","appointments.view"],
  ["Work orders","/admin/jobs","Job scopes, status and staff assignments","jobs.view"],
  ["Quotes","/admin/quotes","Prepare, issue and track customer quotes","quotes.view"],
  ["Invoices & payments","/admin/invoices","Customer billing and payment records","invoices.view"]
 ]},
 {title:"Parts, suppliers & purchasing",description:"Order job-specific parts and track supplier deliveries.",items:[
  ["Suppliers","/admin/suppliers","Supplier contacts and account details","suppliers.view"],
  ["Supplier orders","/admin/supplier-orders","Purchase orders, expected and received parts","suppliers.view"]
 ]},
 {title:"Employees & access",description:"Manage the team and control what each role can access.",items:[
  ["Employee management","/admin/staff","Employee accounts, invitations and status","staff.view"],
  ["Roles & permissions","/admin/roles","Configure employee access groups","roles.manage"]
 ]},
 {title:"Business administration",description:"Manage operating costs and the public customer experience.",items:[
  ["Expenses","/admin/expenses","Business expenses and receipts","expenses.view"],
  ["Website editor","/admin/website","Public website content and service information","website.manage"],
  ["Business settings","/admin/settings","Business configuration and booking rules","settings.manage"]
 ]}
] as const;
export default async function AdminDashboard(){
 const user=await currentUser();if(!user)redirect("/portal/sign-in");const membership=await currentMembership(user.id);if(!membership)redirect("/staff");
 const permissionKeys=[...new Set(menuGroups.flatMap(group=>group.items.map(item=>item[3])))];
 const checks=await Promise.all(permissionKeys.map(p=>userHasPermission(user.id,p)));
 const permitted=new Set(permissionKeys.filter((_,i)=>checks[i]));
 if(!permitted.size)redirect("/staff");
 const db=database();const business=membership.business_id;
 const counts=await Promise.all([
  permitted.has("enquiries.view")?db.from("enquiries").select("id",{count:"exact",head:true}).eq("business_id",business):Promise.resolve({count:null}),
  permitted.has("appointments.view")?db.from("appointments").select("id",{count:"exact",head:true}).eq("business_id",business).in("status",["requested","confirmed","rescheduled"]):Promise.resolve({count:null}),
  permitted.has("jobs.view")?db.from("jobs").select("id",{count:"exact",head:true}).eq("business_id",business).not("status","in","(completed,cancelled)"):Promise.resolve({count:null}),
  permitted.has("quotes.view")?db.from("quotes").select("id",{count:"exact",head:true}).eq("business_id",business).eq("status","sent"):Promise.resolve({count:null})
 ]);
 return <main className="portal-page"><header className="portal-topbar"><div className="shell portal-topbar-inner"><strong>BRANDON RV · BUSINESS ADMIN</strong><div className="portal-topbar-right"><span>{user.full_name} · {membership.role}</span><Link href="/staff">Staff workspace</Link><Link href="/portal/sign-in">Customer portal ↗</Link></div></div></header>
 <div className="shell portal-shell" style={{display:"block",maxWidth:1180}}><div className="portal-welcome"><div><p className="eyebrow"><span className="eyebrow-line"/> BUSINESS CONTROL CENTRE</p><h1>Operations <em>overview.</em></h1><p>One business workspace connected to the customer website and portal.</p></div></div>
 <div className="portal-stat-grid"><article><span>ENQUIRIES</span><strong>{counts[0].count??"—"}</strong><small>Customer service requests</small></article><article><span>UPCOMING BOOKINGS</span><strong>{counts[1].count??"—"}</strong><small>Requested and confirmed</small></article><article><span>OPEN WORK ORDERS</span><strong>{counts[2].count??"—"}</strong><small>Active jobs</small></article><article><span>QUOTES AWAITING RESPONSE</span><strong>{counts[3].count??"—"}</strong><small>Sent to customers</small></article></div>
 <div className="portal-page-heading"><p className="eyebrow"><span className="eyebrow-line"/> BUSINESS MENU</p><h2>Manage Brandon RV</h2><p>Customer and job records are shared with the customer portal. Changes made here appear in the relevant customer's account when the record is linked to their account.</p></div>
 {menuGroups.map(group=>{const items=group.items.filter(item=>permitted.has(item[3]));return items.length?<section className="portal-panel" key={group.title}><div className="portal-panel-heading"><div><span className="panel-kicker">WORKSPACE</span><h2>{group.title}</h2><p>{group.description}</p></div></div><div className="portal-shortcuts">{items.map(item=><Link href={item[1]} key={item[1]}><span>▦</span><strong>{item[0]}</strong><small>{item[2]}</small><b>→</b></Link>)}</div></section>:null})}
 <section className="portal-panel"><div className="portal-panel-heading"><div><span className="panel-kicker">CUSTOMER EXPERIENCE</span><h2>Customer portal</h2><p>Customers use their own secure login to view quotes, appointments, work progress, vehicles, documents and invoices.</p></div><Link className="text-link" href="/portal/sign-in">Open customer sign-in →</Link></div></section>
 </div></main>;
}
