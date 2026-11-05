"use client";

import { useState } from "react";

export default function VehiclesPage() {
  const [notice, setNotice] = useState("");
  return <>
    <div className="portal-page-heading"><p className="eyebrow"><span className="eyebrow-line" /> YOUR VEHICLES</p><h1>Vehicles <em>on file.</em></h1><p>Keep your caravan or motorhome details together for easier service enquiries.</p></div>
    <div className="preview-banner"><span>SAMPLE VEHICLE</span><p>This vehicle is fictional sample data. Vehicle records will be saved securely after backend integration.</p></div>
    <article className="vehicle-card"><div className="vehicle-visual"><span>BR</span><small>VEHICLE PROFILE</small></div><div className="vehicle-details"><span className="panel-kicker">CARAVAN · SAMPLE RECORD</span><h2>2021 Jayco Journey</h2><div className="vehicle-meta"><div><small>MAKE</small><strong>Jayco</strong></div><div><small>MODEL</small><strong>Journey</strong></div><div><small>YEAR</small><strong>2021</strong></div><div><small>REGISTRATION</small><strong>ABC-123</strong></div></div><p>Notes: Sample vehicle profile for layout preview.</p><button className="text-button" onClick={() => setNotice("Vehicle editing will be available when secure customer records are connected.")}>Edit vehicle details →</button></div></article>
    <button className="button button-secondary add-vehicle" onClick={() => setNotice("Adding vehicles will be enabled after the customer account backend is connected.")}>＋ Add another vehicle</button>
    {notice && <p className="inline-notice" role="status">{notice}</p>}
  </>;
}