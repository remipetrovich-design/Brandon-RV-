"use client";

import Link from "next/link";
import {usePathname} from "next/navigation";
import {useState, type ReactNode} from "react";
import SignOutButton from "@/components/sign-out-button";

export type AdminNavItem={label:string;href:string;permission:string;icon:string};
export type AdminNavGroup={title:string;items:AdminNavItem[]};

const iconPaths:Record<string,string>={
  home:"M3 10.5 12 3l9 7.5M5.5 9v11h13V9M9 20v-6h6v6",
  inbox:"M4 4h16v16H4zM4 13h4l2 3h4l2-3h4",
  users:"M16 20v-1.5a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4V20M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM17 4.2a4 4 0 0 1 0 7.6M20 20v-1.5a4 4 0 0 0-2.8-3.8",
  vehicle:"M3 14l1.5-5h15L21 14v5h-3v-2H6v2H3zM5 9l2-4h10l2 4M6 13h.01M18 13h.01",
  calendar:"M4 5h16v15H4zM8 3v4M16 3v4M4 10h16",
  jobs:"M4 7h16v13H4zM8 7V4h8v3M8 12h8M8 16h5",
  quote:"M5 3h14v18H5zM8 8h8M8 12h8M8 16h5",
  finance:"M12 2v20M17 6H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6",
  supplier:"M3 7h18v13H3zM7 7V4h10v3M7 12h10M7 16h6",
  expense:"M4 5h16v14H4zM8 9h8M8 13h5",
  staff:"M16 20v-1.5a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4V20M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM17 8h4M19 6v4",
  access:"M12 3 4 6v5c0 5 3.4 8.5 8 10 4.6-1.5 8-5 8-10V6zM9 12l2 2 4-4",
  website:"M4 4h16v16H4zM4 9h16M9 9v11",
  services:"M4 5h16M4 12h16M4 19h16M8 3v4M15 10v4M11 17v4",
  location:"M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0ZM12 10a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5",
  business:"M3 21V5l9-3 9 3v16M3 10h18M8 10v11M16 10v11M10 14h4",
  settings:"M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-1.8 1.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5v.1h-2.6v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1-1.8-1.8.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H6.4v-2.6h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1 1.8-1.8.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.5v-.1H15v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1 1.8 1.8-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.5 1h.1V14h-.1a1.7 1.7 0 0 0-1.5 1Z"
};

function NavIcon({name}:{name:string}) {
  return <svg className="brv-nav-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={iconPaths[name]??iconPaths.settings}/></svg>;
}

export default function AdminShell({children,userName,role,groups}:{children:ReactNode;userName:string;role:string;groups:AdminNavGroup[]}) {
  const pathname=usePathname()??"/admin";
  const [mobileOpen,setMobileOpen]=useState(false);
  const items=groups.flatMap(group=>group.items);
  const current=items.find(item=>pathname===item.href||(item.href!=="/admin"&&pathname.startsWith(item.href+"/")));
  const title=pathname==="/admin"?"Overview":current?.label??"Business administration";
  const active=(href:string)=>pathname===href||(href!=="/admin"&&pathname.startsWith(href+"/"));
  const initials=userName.split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0]?.toUpperCase()).join("")||"BR";

  return <div className="brv-admin-frame">
    <aside className={"brv-admin-sidebar"+(mobileOpen?" is-open":"")} aria-label="Main navigation">
      <Link href="/admin" className="brv-admin-brand" onClick={()=>setMobileOpen(false)}>
        <img src="/brv-mark.webp" alt="" />
        <span><strong>BRANDON <em>RV</em></strong><small>BUSINESS MANAGEMENT</small></span>
      </Link>
      <nav className="brv-admin-nav" aria-label="Business administration">
        <Link href="/admin" onClick={()=>setMobileOpen(false)} className={"brv-admin-overview"+(pathname==="/admin"?" active":"")} aria-current={pathname==="/admin"?"page":undefined}>
          <NavIcon name="home"/><span>Overview</span>
        </Link>
        {groups.map(group=><section className="brv-admin-nav-group" key={group.title}>
          <h2>{group.title}</h2>
          {group.items.map(item=><Link key={item.href} href={item.href} onClick={()=>setMobileOpen(false)} className={"brv-admin-nav-link"+(active(item.href)?" active":"")} aria-current={active(item.href)?"page":undefined}>
            <NavIcon name={item.icon}/><span>{item.label}</span>
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
          <button type="button" className="brv-admin-menu-toggle" aria-label="Toggle navigation" aria-expanded={mobileOpen} onClick={()=>setMobileOpen(value=>!value)}>
            <span/><span/><span/>
          </button>
          <div className="brv-admin-breadcrumb"><span>Workspace</span><b>/</b><strong>{title}</strong></div>
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
