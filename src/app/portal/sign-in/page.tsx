"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

export default function SignInPage() {
  const [notice, setNotice] = useState("");
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setNotice("Sign-in is a visual preview only. Secure customer authentication will be connected in the backend phase."); }
  return <div className="auth-wrap"><div className="auth-card">
    <p className="eyebrow"><span className="eyebrow-line" /> CUSTOMER ACCESS</p><h1>Welcome <em>back.</em></h1><p className="auth-intro">Sign in to view your enquiries, quotes, bookings and vehicle details.</p>
    <form onSubmit={submit} className="auth-form"><label>Email address<input type="email" required placeholder="you@example.com" autoComplete="email" /></label><label>Password<input type="password" required placeholder="Your password" autoComplete="current-password" /></label><button className="button button-primary" type="submit">Sign in <span>→</span></button></form>
    {notice && <p className="inline-notice" role="status">{notice}</p>}
    <div className="auth-links"><span>New to Brandon RV?</span><Link href="/portal/register">Create an account</Link></div>
    <Link href="/" className="auth-back">← Back to Brandon RV website</Link>
  </div></div>;
}