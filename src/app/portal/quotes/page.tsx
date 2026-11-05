"use client";

import { useState } from "react";

export default function QuotesPage() {
  const [response, setResponse] = useState("");
  return <>
    <div className="portal-page-heading"><p className="eyebrow"><span className="eyebrow-line" /> YOUR QUOTES</p><h1>Quotes & <em>approvals.</em></h1><p>Review proposed work, pricing and the next steps before deciding how to proceed.</p></div>
    <div className="preview-banner"><span>SAMPLE QUOTE</span><p>The quote below is example content for the portal preview, not a real offer or price.</p></div>
    <article className="quote-card">
      <div className="quote-card-top"><div><span className="panel-kicker">QUOTE BRV-00024</span><h2>Interior hardware replacement</h2><p>Prepared 10 November 2026 · Expires 24 November 2026</p></div><span className="status-pill status-amber">Awaiting response</span></div>
      <div className="quote-scope"><h3>Proposed work</h3><p>Inspect and replace selected cupboard hinges and drawer catches in the living area. Final parts and fitment to be confirmed against the vehicle.</p><ul><li>Check existing fittings and measurements</li><li>Supply agreed replacement hardware</li><li>Fit and check operation</li></ul></div>
      <div className="quote-total"><span>Sample estimate (incl. GST)</span><strong>$385.00</strong></div>
      <div className="quote-actions"><button className="button button-primary" onClick={() => setResponse("Preview only: accepting a quote will be enabled when customer accounts and quote workflows are connected.")}>Accept quote</button><button className="button button-secondary" onClick={() => setResponse("Preview only: quote change requests will be connected to the secure customer portal backend.")}>Ask a question / request a change</button></div>
      {response && <p className="inline-notice" role="status">{response}</p>}
    </article>
    <p className="portal-muted-note">A quote only becomes an approved job after your acceptance is recorded and Brandon RV confirms the next steps.</p>
  </>;
}