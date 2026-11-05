import Link from "next/link";

const jobs = [
  { ref: "BRV-00108", title: "Interior fitting inspection", date: "19 Nov 2026", type: "Appointment request", status: "Scheduled", tone: "green" },
  { ref: "BRV-00092", title: "Cupboard hinge adjustment", date: "02 Sep 2026", type: "Completed job", status: "Completed", tone: "blue" }
];

export default function BookingsPage() {
  return <>
    <div className="portal-page-heading"><p className="eyebrow"><span className="eyebrow-line" /> APPOINTMENTS & JOBS</p><h1>Your service <em>history.</em></h1><p>See upcoming visits, work in progress and completed jobs.</p></div>
    <div className="preview-banner"><span>SAMPLE HISTORY</span><p>These entries are example records used to demonstrate the customer portal.</p></div>
    <div className="job-list">{jobs.map((job) => <article className="job-row" key={job.ref}><div className="job-date"><strong>{job.date.split(" ")[0]}</strong><span>{job.date.split(" ").slice(1).join(" ")}</span></div><div className="job-info"><span>{job.ref} · {job.type}</span><h2>{job.title}</h2><p>Vehicle: Sample caravan</p></div><span className={`status-pill status-${job.tone}`}>{job.status}</span></article>)}</div>
    <div className="portal-bottom-cta"><div><strong>Need something else looked at?</strong><span>Send through a new service enquiry for assessment.</span></div><Link className="button button-primary" href="/request-quote">New enquiry →</Link></div>
  </>;
}