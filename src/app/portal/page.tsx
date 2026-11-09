import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser, database } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function PortalDashboard() {
  const user = await currentUser();
  if (!user) redirect("/portal/sign-in");
  const db = database();
  const { data: customer } = await db.from("customers").select("id,full_name").eq("user_id", user.id).maybeSingle();
  if (!customer) return <section className="portal-panel brv-no-customer-profile"><p className="eyebrow"><span className="eyebrow-line"/> CUSTOMER PORTAL</p><h1>Customer profile <em>not linked.</em></h1><p>This login does not currently have a customer profile connected. You can still use the employee or admin workspace if your account has the relevant access.</p><div className="brv-workspace-actions"><Link className="button button-secondary" href="/staff">Open employee panel <span>→</span></Link><Link className="button button-primary" href="/admin">Open admin panel <span>→</span></Link></div><p className="panel-footnote">If you are expecting customer records here, contact Brandon RV to link your customer profile to this login.</p></section>;
  const [enquiries, quotes, appointments] = await Promise.all([
    db.from("enquiries").select("id,status,created_at,requested_service").eq("user_id", user.id).order("created_at", { ascending: false }).limit(5),
    db.from("quotes").select("id,status,total,quote_number").eq("user_id", user.id).order("created_at", { ascending: false }).limit(5),
    db.from("appointments").select("id,status,preferred_start,starts_at,location").eq("user_id", user.id).order("created_at", { ascending: false }).limit(5)
  ]);
  const money = (value: number) => new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(value ?? 0);
  return <>
    <div className="portal-welcome"><div><p className="eyebrow"><span className="eyebrow-line" /> CUSTOMER OVERVIEW</p><h1>Welcome, <em>{customer.full_name.split(" ")[0]}.</em></h1><p>Here is an overview of your Brandon RV requests and account.</p></div><Link className="button button-primary" href="/request-quote">New service enquiry <span>＋</span></Link></div>
    <div className="portal-stat-grid">
      <article><span>YOUR ENQUIRIES</span><strong>{enquiries.data?.length ?? 0}</strong><small>Recent service requests</small></article>
      <article><span>YOUR QUOTES</span><strong>{quotes.data?.length ?? 0}</strong><small>Quotes prepared for you</small></article>
      <article><span>YOUR BOOKINGS</span><strong>{appointments.data?.length ?? 0}</strong><small>Appointment requests and visits</small></article>
    </div>
    <section className="portal-panel"><div className="portal-panel-heading"><div><span className="panel-kicker">RECENT ENQUIRIES</span><h2>Your service requests</h2></div><Link href="/request-quote" className="text-link">New enquiry →</Link></div>
      {enquiries.data?.length ? <div className="activity-list">{enquiries.data.map(item => <div className="activity-item" key={item.id}><div className="activity-date">{new Date(item.created_at).toLocaleDateString("en-AU")}</div><div className="activity-copy"><strong>{item.requested_service || "Service enquiry"}</strong><span>{item.status}</span></div></div>)}</div> : <p className="panel-footnote">You have not submitted an enquiry yet.</p>}
    </section>
    <section className="portal-panel"><div className="portal-panel-heading"><div><span className="panel-kicker">YOUR QUOTES</span><h2>Quotes and pricing</h2></div><Link href="/portal/quotes" className="text-link">View quotes →</Link></div>
      {quotes.data?.length ? <div className="activity-list">{quotes.data.map(item => <div className="activity-item" key={item.id}><div className="activity-date">{item.quote_number}</div><div className="activity-copy"><strong>{money(item.total)}</strong><span>{item.status}</span></div></div>)}</div> : <p className="panel-footnote">No quotes have been issued to your account yet.</p>}
    </section>
    <div className="portal-shortcuts"><Link href="/portal/enquiries"><span>✉</span><strong>Enquiries & messages</strong><small>Contact Brandon RV and follow ticket conversations</small><b>→</b></Link><Link href="/portal/bookings"><span>▦</span><strong>Bookings & jobs</strong><small>Check appointment and job status</small><b>→</b></Link><Link href="/portal/vehicles"><span>◇</span><strong>Your vehicles</strong><small>Keep vehicle details current</small><b>→</b></Link><Link href="/portal/profile"><span>○</span><strong>Account details</strong><small>Review your contact information</small><b>→</b></Link></div>
  </>;
}
