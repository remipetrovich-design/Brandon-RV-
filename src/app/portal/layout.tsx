"use client";
import Link from "next/link";
import {usePathname} from "next/navigation";
import PortalSidebar from "@/components/portal-sidebar";
import PortalAuthGuard from "@/components/portal-auth-guard";
export default function PortalLayout({children}:{children:React.ReactNode}){
 const pathname=usePathname();
 const isAuthPage=["/portal/sign-in","/portal/register","/portal/verify-email","/portal/forgot-password","/portal/reset-password"].includes(pathname);
 return <div className="portal-page"><header className="portal-topbar"><div className="shell portal-topbar-inner"><Link href="/" className="brand"><span className="brand-mark">BR</span><span className="brand-name"><strong>BRANDON <span>RV</span></strong><small>CUSTOMER PORTAL</small></span></Link><div className="portal-topbar-right">{!isAuthPage&&<span>Customer account</span>}<Link href="/">Back to website ↗</Link></div></div></header><PortalAuthGuard>{isAuthPage?children:<div className="shell portal-shell"><PortalSidebar/><main className="portal-main">{children}</main></div>}</PortalAuthGuard><footer className="portal-footer"><div className="shell">Brandon RV · Tamworth NSW <span>Your Brandon RV account</span></div></footer></div>;
}