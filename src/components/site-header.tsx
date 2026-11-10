"use client";
import Link from "next/link";
import {usePathname} from "next/navigation";
import {useState} from "react";

const navigation=[
 {href:"/",label:"Home",matches:["/"]},
 {href:"/about-services",label:"About / Services",matches:["/about-services","/about","/services"]},
 {href:"/how-it-works",label:"How it works / Service areas",matches:["/how-it-works","/service-areas"]},
 {href:"/faq",label:"FAQs",matches:["/faq"]},
 {href:"/general-enquiry",label:"General Enquiry",matches:["/general-enquiry","/contact"]}
];

export default function SiteHeader({brandLine,isLoggedIn}:{brandLine:string;isLoggedIn:boolean}) {
 const pathname=usePathname()??"/";const [menuOpen,setMenuOpen]=useState(false);
 const appArea=["/portal","/staff","/admin","/dev","/initial-owner-setup"].some(base=>pathname===base||pathname.startsWith(base+"/"));
 if(appArea)return null;
 return <header className="site-header">
  <div className="shell header-inner">
   <Link href="/" className="brand" aria-label="Brandon RV home" onClick={()=>setMenuOpen(false)}>
    <span className="brand-symbol"><img src="/brv-mark.webp" alt=""/></span>
    <span className="brand-name"><strong>BRANDON <span>RV</span></strong><small>{brandLine}</small></span>
   </Link>
   <button type="button" className="mobile-nav-toggle" aria-label={menuOpen?"Close navigation":"Open navigation"} aria-expanded={menuOpen} aria-controls="brv-public-menu" onClick={()=>setMenuOpen(value=>!value)}><span/><span/><span/></button>
   <div id="brv-public-menu" className={"header-menu"+(menuOpen?" is-open":"")}>
    <nav className="main-nav" aria-label="Main navigation">
     {navigation.map(item=>{
      const active=item.href==="/"?pathname==="/":item.matches.some(path=>pathname===path||pathname.startsWith(path+"/"));
      return <Link href={item.href} key={item.href} className={active?"active":""} aria-current={active?"page":undefined} onClick={()=>setMenuOpen(false)}>{item.label}</Link>;
     })}
    </nav>
    <div className="header-actions">
     {isLoggedIn?<Link className="header-portal-link" href="/portal" onClick={()=>setMenuOpen(false)}>Customer portal</Link>:<details className="header-auth-menu"><summary>Login / Register</summary><div className="header-auth-popout"><Link href="/portal/sign-in" onClick={()=>setMenuOpen(false)}>Sign in</Link><Link href="/portal/register" onClick={()=>setMenuOpen(false)}>Create an account</Link></div></details>}
     <Link className="header-quote-link" href="/request-quote" onClick={()=>setMenuOpen(false)}>Request a quote <span aria-hidden="true">→</span></Link>
    </div>
   </div>
  </div>
 </header>;
}
