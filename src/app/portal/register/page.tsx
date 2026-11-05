"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

export default function RegisterPage() {
  const [notice, setNotice] = useState("");
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setNotice("Your registration form is ready for backend integration. No account has been created or details stored."); }
  return <div className="auth-wrap"><div className="auth-card auth-card-wide">
    <p className="eyebrow"><span className="eyebrow-line" /> CREATE YOUR ACCOUNT</p><h1>Keep everything <em>in one place.</em></h1><p className="auth-intro">Create a customer account to keep track of your vehicles, enquiries, quotes and service history.</p>
    <form onSubmit={submit} className="auth-form"><div className="form-grid"><label>First name<input required autoComplete="given-name" placeholder="First name" /></label><label>Last name<input required autoComplete="family-name" placeholder="Last name" /></label></div><label>Email address<input type="email" required autoComplete="email" placeholder="you@example.com" /></label><label>Mobile number<input type="tel" required autoComplete="tel" placeholder="04xx xxx xxx" /></label><div className="form-grid"><label>Password<input type="password" required minLength={8} autoComplete="new-password" placeholder="At least 8 characters" /></label><label>Confirm password<input type="password" required minLength={8} autoComplete="new-password" placeholder="Confirm password" /></label></div><label className="consent-check"><input type="checkbox" required /><span>I agree to be contacted about my account and service requests.</span></label><button className="button button-primary" type="submit">Create account <span>→</span></button></form>
    {notice && <p className="inline-notice" role="status">{notice}</p>}<div className="auth-links"><span>Already registered?</span><Link href="/portal/sign-in">Sign in</Link></div><Link href="/" className="auth-back">← Back to Brandon RV website</Link>
  </div></div>;
}