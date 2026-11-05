"use client";
import Link from "next/link";
import {usePathname} from "next/navigation";
export default function SiteFooter({phone,phoneLink,brandLine,location}:{phone:string;phoneLink:string;brandLine:string;location:string}) {
 const pathname=usePathname();const appArea=["/portal","/staff","/admin","/dev","/initial-owner-setup"].some(base=>pathname===base||pathname.startsWith(base+"/"));if(appArea)return null;
 return <footer className="site-footer"><div className="shell footer-main">
  <div className="footer-brand-block"><Link href="/" className="footer-brand"><span>BRANDON</span> RV</Link><p>{brandLine}</p><small>Mobile caravan & motorhome interior repair enquiries.</small></div>
  <nav className="footer-links" aria-label="Footer navigation"><Link href="/about-services">About / Services</Link><Link href="/how-it-works">How it works / Service areas</Link><Link href="/faq">FAQs</Link><Link href="/contact">General enquiries</Link><Link href="/gallery">Previous work</Link><Link href="/portal/sign-in">Customer portal</Link></nav>
  <div className="footer-contact"><span>MOBILE SERVICE · {location}</span><a href={phoneLink}>{phone}</a><Link href="/request-quote">Request a quote <span aria-hidden="true">→</span></Link></div>
 </div><div className="shell footer-bottom"><span>© {new Date().getFullYear()} Brandon RV</span><span>Every request is assessed before a booking is confirmed.</span></div></footer>;
}
