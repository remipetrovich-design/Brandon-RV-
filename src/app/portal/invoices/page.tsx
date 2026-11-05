"use client";

import { useState } from "react";

export default function InvoicesPage() {
  const [notice, setNotice] = useState("");
  return <>
    <div className="portal-page-heading"><p className="eyebrow"><span className="eyebrow-line" /> BILLING</p><h1>Invoices & <em>payments.</em></h1><p>Check invoice totals, payment status and records for completed work.</p></div>
    <div className="preview-banner"><span>SAMPLE FINANCIAL DATA</span><p>All figures and invoice references below are fictional examples. Payment processing is not connected.</p></div>
    <div className="portal-stat-grid invoice-stats"><article><span>OUTSTANDING</span><strong>$0.00</strong><small>Sample account balance</small></article><article><span>PAID THIS YEAR</span><strong>$385.00</strong><small>Sample total</small></article><article><span>OVERDUE</span><strong>$0.00</strong><small>No sample overdue invoices</small></article></div>
    <div className="portal-panel"><div className="portal-panel-heading"><div><span className="panel-kicker">INVOICE HISTORY</span><h2>Your invoices</h2></div></div>
      <div className="invoice-table"><div className="invoice-table-head"><span>INVOICE</span><span>DATE</span><span>TOTAL</span><span>STATUS</span><span /></div>
        <div className="invoice-table-row"><div><strong>BRV-00092</strong><small>Cupboard hinge adjustment</small></div><span>02 Sep 2026</span><strong>$385.00</strong><span className="status-pill status-green">Paid · Sample</span><button className="text-button" disabled>View ↗</button></div>
        <div className="invoice-table-row"><div><strong>BRV-00061</strong><small>Interior inspection</small></div><span>14 Jun 2026</span><strong>$0.00</strong><span className="status-pill status-blue">No charge · Sample</span><button className="text-button" disabled>View ↗</button></div>
      </div>
    </div>
    <p className="portal-muted-note">Online payments, downloadable tax invoices and payment receipts will be enabled when the backend and payment provider are configured.</p>
    <button className="text-button" onClick={() => setNotice("Payment and invoice support will be connected in the backend phase.")}>Need help with an invoice? Contact us →</button>
    {notice && <p className="inline-notice" role="status">{notice}</p>}
  </>;
}