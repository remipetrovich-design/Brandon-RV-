import Link from "next/link";
import {redirect} from "next/navigation";
import {currentUser,currentMembership,database,userHasPermissions} from "@/lib/auth";
import {getAdminDashboardSnapshot} from "@/lib/admin-dashboard";
import StaffTasks from "@/components/staff-tasks";
import StaffTimeClock from "@/components/staff-time-clock";
export const dynamic="force-dynamic";
export default async function AdminDashboard() {
 const user=await currentUser();if(!user)redirect("/portal/sign-in");
 const membership=await currentMembership(user.id);if(!membership)redirect("/portal");
 const keys=["enquiries.view","appointments.view","jobs.view","quotes.view","invoices.view","suppliers.view","business.settings.manage","website.manage","settings.manage"];
 const allowed=await userHasPermissions(user.id,keys);
 const db=database();const businessId=membership.business_id;
 const [snapshot,staffProfile]=await Promise.all([
  getAdminDashboardSnapshot(businessId),
  db.from("staff").select("id").eq("user_id",user.id).eq("business_id",businessId).maybeSingle()
 ]);
 const {counts,business}=snapshot;
 const stats=[
  {label:"NEW ENQUIRIES",value:counts.enquiries,detail:"Customer requests to review",href:"/admin/enquiries",permission:"enquiries.view"},
  {label:"BOOKING REQUESTS",value:counts.appointments,detail:"Requested and confirmed visits",href:"/admin/appointments",permission:"appointments.view"},
  {label:"OPEN WORKCARDS",value:counts.jobs,detail:"Jobs not yet closed",href:"/admin/jobs",permission:"jobs.view"},
  {label:"QUOTES TO REVIEW",value:counts.quotes,detail:"Quotes awaiting a response",href:"/admin/quotes",permission:"quotes.view"},
  {label:"INVOICES",value:counts.invoices,detail:"Invoices recorded",href:"/admin/invoices",permission:"invoices.view"},
  {label:"PARTS ORDERS",value:counts.supplierOrders,detail:"Orders still being processed",href:"/admin/supplier-orders",permission:"suppliers.view"}
 ].filter(item=>allowed.has(item.permission));
 const quickLinks=[
  {label:"Enquiries & requests",detail:"Review public contact forms, general enquiries, customer tickets and quote requests in one register",href:"/admin/enquiries",permission:"enquiries.view"},
  {label:"Manage appointments",detail:"Review requests and schedule visits",href:"/admin/appointments",permission:"appointments.view"},
  {label:"Manage Workcards",detail:"Track approved Workcards and progress",href:"/admin/jobs",permission:"jobs.view"},
  {label:"Prepare a quote",detail:"Create and send an itemised quote",href:"/admin/quotes",permission:"quotes.view"},
  {label:"Invoices & payments",detail:"Issue invoices and record payments",href:"/admin/invoices",permission:"invoices.view"},
  {label:"Supplier orders",detail:"Track parts, delivery and supplier costs",href:"/admin/supplier-orders",permission:"suppliers.view"}
 ].filter(item=>allowed.has(item.permission));
 const setupLinks=[
  {label:"Business profile",href:"/admin/business-profile",permission:"business.settings.manage"},
  {label:"Approved services",href:"/admin/services",permission:"business.settings.manage"},
  {label:"Service areas",href:"/admin/service-areas",permission:"business.settings.manage"},
  {label:"Website content",href:"/admin/website",permission:"website.manage"},
  {label:"Business settings",href:"/admin/settings",permission:"settings.manage"}
 ].filter(item=>allowed.has(item.permission));
 const prelaunch=business?.status==="prelaunch";
 return <main className="portal-page brv-admin-dashboard"><div className="shell portal-shell" style={{display:"block",maxWidth:1320}}>
  <div className="portal-welcome brv-admin-welcome"><div><p className="eyebrow"><span className="eyebrow-line"/> BUSINESS WORKSPACE</p><h1>Business <em>overview.</em></h1><p>{business?.name??"Brandon RV"} · {[business?.city,business?.region].filter(Boolean).join(", ")||"Tamworth NSW"}</p></div><span className={"brv-admin-status"+(prelaunch?" prelaunch":"")}>{business?.status??"Business workspace"}</span></div>
  {prelaunch&&<section className="brv-admin-launch-notice"><span>PRE-LAUNCH</span><div><strong>Business setup is still in progress.</strong><p>Confirm the business details, approved service menu, service area and website content before publishing or accepting live work.</p></div>{setupLinks.length>0&&<Link href={setupLinks[0].href}>Continue setup →</Link>}</section>}
  {stats.length>0&&<><div className="brv-admin-section-heading"><div><span>LIVE WORKSPACE</span><h2>Operational snapshot</h2></div><small>Live counts from the Brandon RV business database</small></div><div className="portal-stat-grid brv-admin-stat-grid">{stats.map(stat=><Link className="brv-admin-stat" href={stat.href} key={stat.label}><span>{stat.label}</span><strong>{stat.value??"—"}</strong><small>{stat.detail}</small><b>Open →</b></Link>)}</div></>}
  {quickLinks.length>0&&<><div className="brv-admin-section-heading"><div><span>DAILY OPERATIONS</span><h2>Get work moving</h2></div></div><div className="portal-shortcuts brv-admin-quicklinks">{quickLinks.map(item=><Link href={item.href} key={item.href}><strong>{item.label}</strong><small>{item.detail}</small><span aria-hidden="true">→</span></Link>)}</div></>}
  {staffProfile.data&&<section className="portal-panel"><div className="portal-panel-heading"><div><span className="panel-kicker">MY WORK</span><h2>Employee tools</h2><p>Your assigned Workcards have their own page. Your tasks and time clock remain available here.</p></div></div><StaffTasks/><StaffTimeClock/></section>}
  {setupLinks.length>0&&<section className="portal-panel brv-admin-setup-panel"><div className="portal-panel-heading"><div><span className="panel-kicker">BUSINESS CONFIGURATION</span><h2>Manage the customer-facing business</h2><p>Keep the website, services and business details connected to the same records used by the business workspace.</p></div></div><div className="brv-admin-setup-links">{setupLinks.map(item=><Link href={item.href} key={item.href}>{item.label}<span>→</span></Link>)}</div></section>}
 </div></main>;
}
