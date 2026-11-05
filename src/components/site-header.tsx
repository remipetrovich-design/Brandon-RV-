"use client";
import Link from "next/link";
import {usePathname} from "next/navigation";

const navigation = [
  { href: "/", label: "Home" },
  { href: "/services", label: "Services" },
  { href: "/service-areas", label: "Service areas" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" }
];

export default function SiteHeader({phone,phoneLink,brandLine}:{phone:string;phoneLink:string;brandLine:string}) {
  const pathname = usePathname();
  const appArea = ["/portal", "/staff", "/admin", "/dev", "/initial-owner-setup"].some((base) => pathname === base || pathname.startsWith(base + "/"));
  if (appArea) return null;

  return (
    <header className="site-header">
      <div className="shell header-inner">
        <Link href="/" className="brand" aria-label="Brandon RV home">
          <span className="brand-mark" aria-hidden="true">BR</span>
          <span className="brand-name">
            <strong>BRANDON <span>RV</span></strong>
            <small>{brandLine}</small>
          </span>
        </Link>
        <nav className="main-nav" aria-label="Main navigation">
          {navigation.map((item) => <Link href={item.href} key={item.href}>{item.label}</Link>)}
        </nav>
        <div className="header-actions">
          <Link className="header-portal-link" href="/portal/sign-in">Customer portal</Link>
          <a className="header-call" href={phoneLink}><span>Call Chris</span><strong>{phone}</strong></a>
        </div>
      </div>
    </header>
  );
}