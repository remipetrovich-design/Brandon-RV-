"use client";

import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function AcceptStaffInvitationPage() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token") ?? "";
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setNotice(""); setBusy(true);
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    if (password !== String(form.get("confirmPassword") ?? "")) { setNotice("The passwords do not match."); setBusy(false); return; }
    try {
      const response = await fetch("/api/auth/accept-invitation", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, password }) });
      const result = await response.json();
      if (!response.ok) { setNotice(result.error ?? "Could not accept invitation."); return; }
      router.replace("/staff"); router.refresh();
    } catch { setNotice("Could not accept invitation."); }
    finally { setBusy(false); }
  }
  return <main className="auth-wrap"><section className="auth-card"><p className="eyebrow"><span className="eyebrow-line" /> STAFF ACCESS</p><h1>Set up your <em>account.</em></h1><p className="auth-intro">Choose a password to activate your Brandon RV staff account.</p>
    {!token ? <p className="inline-notice">This invitation link is missing its token.</p> : <form className="auth-form" onSubmit={submit}><label>Password<input name="password" type="password" minLength={12} maxLength={128} required autoComplete="new-password" /></label><label>Confirm password<input name="confirmPassword" type="password" minLength={12} maxLength={128} required autoComplete="new-password" /></label><button className="button button-primary" disabled={busy}>{busy ? "Activating…" : "Activate staff account"} →</button></form>}
    {notice && <p className="inline-notice" role="alert">{notice}</p>}
  </section></main>;
}
