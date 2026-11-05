"use client";
import Link from "next/link";
import {usePathname} from "next/navigation";
import SignOutButton from "@/components/sign-out-button";

const links=[
  {href:"/portal",label:"Overview",icon:"home"},
  {href:"/portal/quotes",label:"Quotes",icon:"quote"},
  {href:"/portal/bookings",label:"Bookings & jobs",icon:"calendar"},
  {href:"/portal/vehicles",label:"My vehicles",icon:"vehicle"},
  {href:"/portal/documents",label:"Documents",icon:"document"},
  {href:"/portal/invoices",label:"Invoices & payments",icon:"payment"},
  {href:"/portal/profile",label:"My details",icon:"user"}
];

const paths:Record<string,string>={
  home:"M3 10.5 12 3l9 7.5M5.5 9v11h13V9M9 20v-6h6v6",
  quote:"M5 3h14v18H5zM8 8h8M8 12h8M8 16h5",
  calendar:"M4 5h16v15H4zM8 3v4M16 3v4M4 10h16",
  vehicle:"M3 14l1.5-5h15L21 14v5h-3v-2H6v2H3zM5 9l2-4h10l2 4",
  document:"M6 3h9l4 4v14H6zM15 3v5h4M9 12h7M9 16h7",
  payment:"M3 6h18v13H3zM3 10h18M7 15h4",
  user:"M20 21v-1.5a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4V21M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8"
};

function PortalIcon({name}:{name:string}) {
  return <svg className="portal-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]??paths.document}/></svg>;
}

export default function PortalSidebar() {
  const pathname=usePathname();
  return (
    <aside className="portal-sidebar">
      <div className="portal-sidebar-heading">YOUR ACCOUNT</div>
      <nav aria-label="Customer portal">
        {links.map(link=>{
          const active=link.href==="/portal"?pathname===link.href:pathname===link.href||pathname.startsWith(link.href+"/");
          return <Link className={active?"portal-nav-link active":"portal-nav-link"} href={link.href} key={link.href} aria-current={active?"page":undefined}>
            <PortalIcon name={link.icon}/><span>{link.label}</span>
          </Link>;
        })}
      </nav>
      <div className="portal-sidebar-help">
        <span>NEED A HAND?</span>
        <strong>Talk to Brandon RV</strong>
        <a href="tel:+61407189087">0407 189 087</a>
      </div>
      <SignOutButton/>
    </aside>
  );
}
