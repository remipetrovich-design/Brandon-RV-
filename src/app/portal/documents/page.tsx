import Link from "next/link";

const docs = [
  { name: "Quote BRV-00024", detail: "Interior hardware replacement · 10 Nov 2026", type: "QUOTE", icon: "▤" },
  { name: "Service summary BRV-00092", detail: "Cupboard hinge adjustment · 02 Sep 2026", type: "JOB RECORD", icon: "▧" },
  { name: "Invoice BRV-00092", detail: "Completed service · 02 Sep 2026", type: "INVOICE", icon: "$" }
];

export default function DocumentsPage() {
  return <>
    <div className="portal-page-heading"><p className="eyebrow"><span className="eyebrow-line" /> YOUR DOCUMENTS</p><h1>Files & <em>paperwork.</em></h1><p>Quotes, invoices and service records associated with your vehicles.</p></div>
    <div className="preview-banner"><span>SAMPLE DOCUMENTS</span><p>Document downloads and secure file storage will be connected in the backend phase.</p></div>
    <div className="document-list">{docs.map((doc) => <article className="document-row" key={doc.name}><span className="document-icon">{doc.icon}</span><div><strong>{doc.name}</strong><small>{doc.detail}</small></div><span className="document-type">{doc.type}</span><button className="text-button" disabled title="Document storage is not connected yet">View file ↗</button></article>)}</div>
    <p className="portal-muted-note">Your documents will only be visible to you and authorised Brandon RV staff once secure sign-in and file permissions are connected.</p>
    <Link href="/portal" className="text-link">← Back to overview</Link>
  </>;
}