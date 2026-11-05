import Link from "next/link";
import {redirect} from "next/navigation";
import {currentUser,currentMembership,database,userHasPermission} from "@/lib/auth";

export const dynamic="force-dynamic";

export default async function AdminDashboard() {
  const user=await currentUser();
  if(!user)redirect("/portal/sign-in");
  const membership=await currentMembership(user.id);
  if(!membership)redirect("/staff");

  const keys=["enquiries.view","appointments.view","jobs.view","quotes.view","invoices.view","suppliers.view","business.settings.manage","website.manage","settings.manage"];
  const checks=await Promise.all(keys.map(key=>userHasPermission(user.id,key)));
  const allowed=new Set(keys.filter((_,index)=>checks[index]));
  const db=database();
  const businessId=membership.business_id;

  const [enquiries,appointments,jobs,quotes,invoices,supplierOrders,businessResult]=await Promise.all([
    allowed.has("enquiries.view")?db.from("enquiries").select("id",{count:"exact",head:true}).eq("business_id",businessId):Promise.resolve({count:null}),
    allowed.has("appointments.view")?db.from("appointments").select("id",{count:"exact",head:true}).eq("business_id",businessId).in("status",["requested","confirmed","rescheduled"]):Promise.resolve({count:null}),
    allowed.has("jobs.view")?db.from("jobs").select("id",{count:"exact",head:true}).eq("business_id",businessId).not("status","in","(completed,cancelled)"):Promise.resolve({count:null}),
    allowed.has("quotes.view")?db.from("quotes").select("id",{count:"exact",head:true}).eq("business_id",businessId).eq("status","sent"):Promise.resolve({count:null}),
    allowed.has("invoices.view")?db.from("invoices").select("id",{count:"exact",head:true}).eq("business_id",businessId):Promise.resolve({count:null}),
    allowed.has("suppliers.view")?db.from("supplier_orders").select("id",{count:"exact",head:true}).eq("business_id",businessId).in("status",["draft","ordered","part_received"]):Promise.resolve({count:null}),
    db.from("businesses").select("name,status,city,region").eq("id",businessId).maybeSingle()
  ]);

  const stats=[
    {label:"NEW ENQUIRIES",value:enquiries.count,detail:"Customer requests to review",href:"/admin/enquiries",permission:"enquiries.view"},
    {label:"BOOKING REQUESTS",value:appointments.count,detail:"Requested and confirmed visits",href:"/admin/appointments",permission:"appointments.view"},
    {label:"OPEN WORK ORDERS",value:jobs.count,detail:"Jobs not yet closed",href:"/admin/jobs",permission:"jobs.view"},
    {label:"QUOTES TO REVIEW",value:quotes.count,detail:"Quotes awaiting a response",href:"/admin/quotes",permission:"quotes.view"},
    {label:"INVOICES",value:invoices.count,detail:"Invoices recorded",href:"/admin/invoices",permission:"invoices.view"},
    {label:"PARTS ORDERS",value:supplierOrders.count,detail:"Orders still being processed",href:"/admin/supplier-orders",permission:"suppliers.view"}
  ].filter(item=>allowed.has(item.permission));

  const quickLinks=[
    {label:"Review enquiries",detail:"Respond to new customer requests",href:"/admin/enquiries",permission:"enquiries.view",icon:"↗"},
    {label:"Manage appointments",detail:"Review requests and schedule visits",href:"/admin/appointments",permission:"appointments.view",icon:"▦"},
    {label:"Manage work orders",detail:"Track approved work and progress",href:"/admin/jobs",permission:"jobs.view",icon:"▤"},
    {label:"Prepare a quote",detail:"Create and send an itemised quote",href:"/admin/quotes",permission:"quotes.view",icon:"▧"},
    {label:"Invoices & payments",detail:"Issue invoices and record payments",href:"/admin/invoices",permission:"invoices.view",icon:"＄"},
    {label:"Supplier orders",detail:"Track parts, delivery and supplier costs",href:"/admin/supplier-orders",permission:"suppliers.view",icon:"⇢"}
  ].filter(item=>allowed.has(item.permission));

  const setupLinks=[
    {label:"Business profile",href:"/admin/business-profile",permission:"business.settings.manage"},
    {label:"Approved services",href:"/admin/services",permission:"business.settings.manage"},
    {label:"Service areas",href:"/admin/service-areas",permission:"business.settings.manage"},
    {label:"Website content",href:"/admin/website",permission:"website.manage"},
    {label:"Business settings",href:"/admin/settings",permission:"settings.manage"}
  ].filter(item=>allowed.has(item.permission));
  const business=businessResult.data;
  const prelaunch=business?.status==="prelaunch";

  return <main className="portal-page brv-admin-dashboard">
    <div className="shell portal-shell" style={{display:"block",maxWidth:1320}}>
      <div className="portal-welcome brv-admin-welcome">
        <div>
          <p className="eyebrow"><span className="eyebrow-line"/> BUSINESS CONTROL CENTRE</p>
          <h1>Business <em>overview.</em></h1>
          <p>{business?.name??"Brandon RV"} · {[business?.city,business?.region].filter(Boolean).join(", ")||"Tamworth NSW"}</p>
        </div>
        <span className={"brv-admin-status"+(prelaunch?" prelaunch":"")}>{business?.status??"Business workspace"}</span>
      </div>

      {prelaunch&&<section className="brv-admin-launch-notice">
        <span>PRE-LAUNCH</span>
        <div><strong>Business setup is still in progress.</strong><p>Confirm the business details, approved service menu, service area and website content before publishing or accepting live work.</p></div>
        {setupLinks.length>0&&<Link href={setupLinks[0].href}>Continue setup →</Link>}
      </section>}

      <div className="brv-admin-section-heading"><div><span>LIVE WORKSPACE</span><h2>Operational snapshot</h2></div><small>Live counts from the Brandon RV business database</small></div>
      <div className="portal-stat-grid brv-admin-stat-grid">
        {stats.map(stat=><Link className="brv-admin-stat" href={stat.href} key={stat.label}>
          <span>{stat.label}</span><strong>{stat.value??"—"}</strong><small>{stat.detail}</small><b>Open →</b>
        </Link>)}
      </div>

      <div className="brv-admin-section-heading"><div><span>DAILY OPERATIONS</span><h2>Get work moving</h2></div></div>
      <div className="portal-shortcuts brv-admin-quicklinks">
        {quickLinks.map(item=><Link href={item.href} key={item.href}>
          <span>{item.icon}</span><strong>{item.label}</strong><small>{item.detail}</small><b>Open →</b>
        </Link>)}
      </div>

      {setupLinks.length>0&&<section className="portal-panel brv-admin-setup-panel">
        <div className="portal-panel-heading"><div><span className="panel-kicker">BUSINESS CONFIGURATION</span><h2>Manage the customer-facing business</h2><p>Keep the website, services and business details connected to the same records used by the admin workspace.</p></div></div>
        <div className="brv-admin-setup-links">{setupLinks.map(item=><Link href={item.href} key={item.href}>{item.label}<span>→</span></Link>)}</div>
      </section>}
    </div>
  </main>;
}
