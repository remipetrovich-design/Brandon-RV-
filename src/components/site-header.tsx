"use client";
import Link from "next/link";
import {usePathname} from "next/navigation";
import {useState} from "react";

const navigation=[
  {href:"/",label:"Home"},{href:"/services",label:"Services"},{href:"/how-it-works",label:"How it works"},
  {href:"/service-areas",label:"Service areas"},{href:"/about",label:"About"},{href:"/faq",label:"FAQs"},{href:"/contact",label:"Contact"}
];

export default function SiteHeader({phone,phoneLink,brandLine}:{phone:string;phoneLink:string;brandLine:string}) {
  const pathname=usePathname();
  const [menuOpen,setMenuOpen]=useState(false);
  const appArea=["/portal","/staff","/admin","/dev","/initial-owner-setup"].some(base=>pathname===base||pathname.startsWith(base+"/"));
  if(appArea)return null;
  return <header className="site-header">
    <div className="shell header-inner">
      <Link href="/" className="brand" aria-label="Brandon RV home" onClick={()=>setMenuOpen(false)}>
        <span className="brand-symbol"><img src="/brv-mark.webp" alt=""/></span>
        <span className="brand-name"><strong>BRANDON <span>RV</span></strong><small>{brandLine}</small></span>
      </Link>
      <nav id="brv-main-navigation" className={"main-nav"+(menuOpen?" is-open":"")} aria-label="Main navigation">
        {navigation.map(item=>{
          const active=item.href==="/"?pathname==="/":pathname===item.href||pathname.startsWith(item.href+"/");
          return <Link href={item.href} key={item.href} className={active?"active":""} aria-current={active?"page":undefined} onClick={()=>setMenuOpen(false)}>{item.label}</Link>;
        })}
      </nav>
      <div className="header-actions">
        <Link className="header-portal-link" href="/portal/sign-in">Customer portal</Link>
        <Link className="header-quote-link" href="/request-quote">Request a quote <span aria-hidden="true">→</span></Link>
        <a className="header-call" href={phoneLink}><span>Call Chris</span><strong>{phone}</strong></a>
      </div>
      <button type="button" className="mobile-nav-toggle" aria-label={menuOpen?"Close navigation":"Open navigation"} aria-expanded={menuOpen} aria-controls="brv-main-navigation" onClick={()=>setMenuOpen(value=>!value)}><span/><span/><span/></button>
    </div>
  </header>;
}
