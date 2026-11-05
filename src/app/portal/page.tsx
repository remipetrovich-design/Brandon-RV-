import Link from "next/link";

const activity = [
  { date: "12 Oct 2026", title: "Enquiry received", detail: "Cabinet door and drawer repair", status: "Under review", tone: "amber" },
  { date: "08 Oct 2026", title: "Quote prepared", detail: "Interior hardware replacement", status: "Awaiting response", tone: "blue" }
];

export default function PortalDashboard() {
  return <>
    <div className="portal-welcome"><div><p className="eyebrow"><span className="eyebrow-line" /> CUSTOMER OVERVIEW</p><h1>Good morning, <em>Alex.</em></h1><p>Here is an overview of your requests and upcoming work.</p></div><Link className="button button-primary" href="/request-quote">New service enquiry <span>＋</span></Link></div>
    <div className="preview-banner"><span>PREVIEW ACCOUNT</span><p>This portal is showing sample information so you can review the customer experience. No real customer records or bookings are connected yet.</p></div>
    <div className="portal-stat-grid">
      <article><span>OPEN ENQUIRIES</span><strong>02</strong><small>Requests being reviewed</small></article>
      <article><span>QUOTES TO REVIEW</span><strong>01</strong><small>Waiting for your response</small></article>
      <article><span>UPCOMING BOOKINGS</span><strong>01</strong><small>Next scheduled visit</small></article>
    </div>
    <section className="portal-panel">
      <div className="portal-panel-heading"><div><span className="panel-kicker">YOUR NEXT APPOINTMENT</span><h2>Interior fitting inspection</h2></div><span className="status-pill status-green">Scheduled · Sample</span></div>
      <div className="appointment-details"><div><small>DATE</small><strong>Thursday, 19 November 2026</strong></div><div><small>TIME</small><strong>To be confirmed</strong></div><div><small>LOCATION</small><strong>Customer address on file</strong></div></div>
      <p className="panel-footnote">This is sample appointment data. A real booking is only confirmed after Brandon RV checks availability and job requirements.</p>
    </section>
    <section className="portal-panel">
      <div className="portal-panel-heading"><div><span className="panel-kicker">RECENT ACTIVITY</span><h2>Updates on your requests</h2></div><Link href="/portal/bookings" className="text-link">View all →</Link></div>
      <div className="activity-list">{activity.map((item) => <div className="activity-item" key={item.title}><div className="activity-date">{item.date}</div><div className="activity-copy"><strong>{item.title}</strong><span>{item.detail}</span></div><span className={`status-pill status-${item.tone}`}>{item.status}</span></div>)}</div>
    </section>
    <div className="portal-shortcuts"><Link href="/portal/quotes"><span>▤</span><strong>Review a quote</strong><small>Check pricing and scope</small><b>→</b></Link><Link href="/portal/vehicles"><span>◇</span><strong>Your vehicles</strong><small>Keep vehicle details current</small><b>→</b></Link><Link href="/portal/documents"><span>▧</span><strong>Your documents</strong><small>Quotes, invoices and job records</small><b>→</b></Link></div>
  </>;
}