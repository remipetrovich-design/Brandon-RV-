"use client";
import Link from "next/link";
import {usePathname} from "next/navigation";

export default function SiteFooter({phone,phoneLink,brandLine,location}:{phone:string;phoneLink:string;brandLine:string;location:string}) {
  const pathname = usePathname();
  const appArea = ["/portal", "/staff", "/admin", "/dev", "/initial-owner-setup"].some((base) => pathname === base || pathname.startsWith(base + "/"));
  if (appArea) return null;

  return (
    <footer className="site-footer">
      <div className="shell footer-main">
        <div>
          <Link href="/" className="footer-brand">BRANDON <span>RV</span></Link>
          <p>{brandLine}</p>
        </div>
        <div className="footer-links">
          <Link href="/services">Services</Link>
          <Link href="/about">About</Link>
          <Link href="/contact">Contact</Link>
        </div>
        <div className="footer-contact">
          <span>Mobile service · {location}</span>
          <a href={phoneLink}>{phone}</a>
        </div>
      </div>
      <div className="shell footer-bottom">
        <span>© {new Date().getFullYear()} Brandon RV</span>
        <span>Service enquiries are assessed before a booking is confirmed.</span>
      </div>
    </footer>
  );
}