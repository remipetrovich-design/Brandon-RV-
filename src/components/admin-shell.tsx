"use client";

import Link from "next/link";
import {usePathname} from "next/navigation";
import {useState, type ReactNode} from "react";
import SignOutButton from "@/components/sign-out-button";

export type AdminNavItem = {label:string;href:string;permission:string;icon:string};
export type AdminNavGroup = {title:string;items:AdminNavItem[]};

export default function AdminShell({children,userName,role,groups}:{children:ReactNode;userName:string;role:string;groups:AdminNavGroup[]}) {
  const pathname=usePathname()??"/admin";
  const [mobileOpen,setMobileOpen]=useState(false);
  const items=groups.flatMap(group=>group.items);
  const current=items.find(item=>pathname===item.href||(item.href!=="/admin"&&pathname.startsWith(item.href+"/")));
  const title=pathname==="/admin"?"Overview":current?.label??"Business administration";
  const active=(href:string)=>pathname===href||(href!=="/admin"&&pathname.startsWith(href+"/"));
  const initials=userName.split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0]?.toUpperCase()).join("")||"BR";

  return <div className="brv-admin-frame">
    <aside className={"brv-admin-sidebar"+(mobileOpen?" is-open":"")}>
      <Link href="/admin" className="brv-admin-brand" onClick={()=>setMobileOpen(false)}>
        <img src="/brv-mark.webp" alt="" />
        <span><strong>BRANDON <em>RV</em></strong><small>BUSINESS CONTROL CENTRE</small></span>
      </Link>
      <div className="brv-admin-sidebar-caption">WORKSPACE</div>
      <nav className="brv-admin-nav" aria-label="Business administration">
        <Link href="/admin" onClick={()=>setMobileOpen(false)} className={"brv-admin-overview"+(pathname==="/admin"?" active":"")} aria-current={pathname==="/admin"?"page":undefined}>
          <span className="brv-admin-nav-icon">⌂</span><span>Overview</span>
        </Link>
        {groups.map(group=><section className="brv-admin-nav-group" key={group.title}>
          <h2>{group.title}</h2>
          {group.items.map(item=><Link key={item.href} href={item.href} onClick={()=>setMobileOpen(false)} className={"brv-admin-nav-link"+(active(item.href)?" active":"")} aria-current={active(item.href)?"page":undefined}>
            <span className="brv-admin-nav-icon" aria-hidden="true">{item.icon}</span><span>{item.label}</span>
          </Link>)}
        </section>)}
      </nav>
      <div className="brv-admin-sidebar-footer">
        <div className="brv-admin-user">
          <span className="brv-admin-avatar">{initials}</span>
          <span><strong>{userName}</strong><small>{role.replaceAll("_"," ")}</small></span>
        </div>
        <SignOutButton />
      </div>
    </aside>
    {mobileOpen&&<button type="button" className="brv-admin-backdrop" aria-label="Close navigation" onClick={()=>setMobileOpen(false)} />}
    <div className="brv-admin-main">
      <header className="brv-admin-topbar">
        <div className="brv-admin-topbar-left">
          <button type="button" className="brv-admin-menu-toggle" aria-label="Open navigation" aria-expanded={mobileOpen} onClick={()=>setMobileOpen(value=>!value)}>☰</button>
          <div className="brv-admin-breadcrumb"><span>BRANDON RV</span><b>/</b><strong>{title}</strong></div>
        </div>
        <div className="brv-admin-topbar-actions">
          <Link href="/" target="_blank">View website <span aria-hidden="true">↗</span></Link>
          <Link href="/portal/sign-in" target="_blank">Customer portal <span aria-hidden="true">↗</span></Link>
        </div>
      </header>
      <div className="brv-admin-content">{children}</div>
    </div>
  </div>;
}
