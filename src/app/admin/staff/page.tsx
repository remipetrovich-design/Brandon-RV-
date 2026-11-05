"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";

export default function StaffManagementPage() {
  const [notice, setNotice] = useState("");
  const [inviteUrl, setInviteUrl] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setNotice(""); setInviteUrl(""); setBusy(true);
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      const response = await fetch("/api/staff/invitations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fullName: form.get("fullName"), email: form.get("email"), role: form.get("role") }) });
      const result = await response.json();
      if (!response.ok) { setNotice(result.error ?? "Could not invite staff member."); return; }
      setInviteUrl(result.invitationUrl); setNotice("Invitation created. Copy the link and send it to the staff member. It expires in seven days.");
      formElement.reset();
    } catch { setNotice("Could not create invitation."); }
    finally { setBusy(false); }
  }
  return <main className="portal-page"><header className="portal-topbar"><div className="shell portal-topbar-inner"><strong>BRANDON RV · STAFF MANAGEMENT</strong><Link href="/staff">Staff workspace</Link></div></header><div className="shell portal-shell" style={{display:"block",maxWidth:760}}><p className="eyebrow"><span className="eyebrow-line" /> USER MANAGEMENT</p><h1 style={{fontFamily:"Georgia,serif",fontWeight:400}}>Invite a <em>staff member.</em></h1><p className="auth-intro">Create a secure, one-time invitation. Staff choose their own password when they activate the account.</p><section className="portal-panel"><form className="auth-form" onSubmit={submit}><label>Full name<input name="fullName" required minLength={2} /></label><label>Email address<input name="email" type="email" required /></label><label>Role<select name="role" defaultValue="technician"><option value="administrator">Administrator</option><option value="manager">Manager</option><option value="technician">Technician</option><option value="office">Office staff</option><option value="accounts">Accounts</option></select></label><button className="button button-primary" disabled={busy}>{busy ? "Creating invitation…" : "Create staff invitation"} →</button></form>{notice && <p className="inline-notice" role="status">{notice}</p>}{inviteUrl && <div className="portal-panel"><label>Staff invitation link<input readOnly value={inviteUrl} onFocus={e=>e.currentTarget.select()} /></label><button className="button button-secondary" type="button" onClick={()=>navigator.clipboard.writeText(inviteUrl)}>Copy invitation link</button></div>}</section></div></main>;
}
