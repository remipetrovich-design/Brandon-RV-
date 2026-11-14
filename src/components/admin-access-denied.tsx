import Link from "next/link";

export default function AdminAccessDenied({resource="this area"}:{resource?:string}) {
  return <main className="portal-page brv-admin-access-denied">
    <div className="shell portal-shell" style={{display:"block",maxWidth:720}}>
      <section className="portal-panel" aria-labelledby="brv-access-denied-title">
        <span className="panel-kicker">ACCESS CONTROL</span>
        <h1 id="brv-access-denied-title">Access restricted</h1>
        <p>Your account does not have permission to view {resource}. Your existing work and account access have not been changed.</p>
        <p>If you need access, ask a manager or business administrator to review your role permissions.</p>
        <Link className="button button-primary" href="/admin">Return to workspace</Link>
      </section>
    </div>
  </main>;
}
