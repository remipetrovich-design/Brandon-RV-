"use client";
import Link from "next/link";
import {usePathname} from "next/navigation";
import PortalSidebar from "@/components/portal-sidebar";
import PortalAuthGuard from "@/components/portal-auth-guard";

export default function PortalLayout({children}:{children:React.ReactNode}) {
  const pathname=usePathname();
  const isAuthPage=["/portal/sign-in","/portal/register","/portal/verify-email","/portal/forgot-password","/portal/reset-password"].includes(pathname);
  return (
    <div className="portal-page">
      <header className="portal-topbar">
        <div className="shell portal-topbar-inner">
          <Link href="/" className="brand" aria-label="Brandon RV website">
            <span className="brand-symbol"><img src="/brv-mark.webp" alt="" /></span>
            <span className="brand-name"><strong>BRANDON <span>RV</span></strong><small>CUSTOMER PORTAL</small></span>
          </Link>
          <div className="portal-topbar-right">
            {!isAuthPage&&<span className="portal-account-label">CUSTOMER ACCOUNT</span>}
            <Link href="/staff" className="portal-workspace-link">Employee panel</Link>
            <Link href="/admin" className="portal-workspace-link">Admin panel</Link>
            <Link href="/">Back to website <span aria-hidden="true">↗</span></Link>
          </div>
        </div>
      </header>
      <PortalAuthGuard>
        {isAuthPage
          ? <div className="portal-auth-layout">{children}</div>
          : <div className="shell portal-shell"><PortalSidebar/><main className="portal-main">{children}</main></div>}
      </PortalAuthGuard>
      <footer className="portal-footer"><div className="shell"><span>Brandon RV · Tamworth NSW</span><span>Your account and service records in one place.</span></div></footer>
    </div>
  );
}
