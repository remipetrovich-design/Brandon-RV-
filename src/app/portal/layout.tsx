import Link from "next/link";
import PortalSidebar from "@/components/portal-sidebar";

export default function PortalLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <div className="portal-page">
    <header className="portal-topbar">
      <div className="shell portal-topbar-inner">
        <Link href="/" className="brand"><span className="brand-mark">BR</span><span className="brand-name"><strong>BRANDON <span>RV</span></strong><small>CUSTOMER PORTAL</small></span></Link>
        <div className="portal-topbar-right"><span>Customer account preview</span><Link href="/">Back to website ↗</Link></div>
      </div>
    </header>
    <div className="shell portal-shell"><PortalSidebar /><main className="portal-main">{children}</main></div>
    <footer className="portal-footer"><div className="shell">Brandon RV · Tamworth NSW <span>Portal preview — secure account services are not connected yet.</span></div></footer>
  </div>;
}