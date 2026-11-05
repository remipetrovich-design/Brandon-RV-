"use client";

import { FormEvent, useState } from "react";

export default function ProfilePage() {
  const [notice, setNotice] = useState("");
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setNotice("Profile editing is a preview. Changes will be saved once secure customer accounts are connected."); }
  return <>
    <div className="portal-page-heading"><p className="eyebrow"><span className="eyebrow-line" /> ACCOUNT SETTINGS</p><h1>Your <em>details.</em></h1><p>Manage the contact information used for service updates and bookings.</p></div>
    <div className="preview-banner"><span>DEMO PROFILE</span><p>Sample details only. Do not enter real personal information in this preview.</p></div>
    <form className="profile-form" onSubmit={submit}><h2>Contact information</h2><div className="form-grid"><label>First name<input defaultValue="Alex" /></label><label>Last name<input defaultValue="Taylor" /></label><label>Email address<input type="email" defaultValue="alex@example.com" /></label><label>Mobile number<input type="tel" defaultValue="0400 000 000" /></label></div><h2>Address</h2><div className="form-grid"><label>Street address<input defaultValue="Sample Street" /></label><label>Suburb<input defaultValue="Tamworth" /></label><label>State<input defaultValue="NSW" /></label><label>Postcode<input defaultValue="2340" /></label></div><button className="button button-primary" type="submit">Save changes <span>→</span></button>{notice && <p className="inline-notice" role="status">{notice}</p>}</form>
  </>;
}