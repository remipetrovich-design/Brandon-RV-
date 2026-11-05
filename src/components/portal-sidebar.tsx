"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import SignOutButton from "@/components/sign-out-button";

const links = [
  { href: "/portal", label: "Overview", icon: "⌂" },
  { href: "/portal/quotes", label: "Quotes", icon: "▤" },
  { href: "/portal/bookings", label: "Bookings & jobs", icon: "▦" },
  { href: "/portal/vehicles", label: "My vehicles", icon: "◇" },
  { href: "/portal/documents", label: "Documents", icon: "▧" },
  { href: "/portal/invoices", label: "Invoices & payments", icon: "$" },
  { href: "/portal/profile", label: "My details", icon: "○" }
];

export default function PortalSidebar() {
  const pathname = usePathname();
  return (
    <aside className="portal-sidebar">
      <div className="portal-sidebar-heading">YOUR ACCOUNT</div>
      <nav aria-label="Customer portal">
        {links.map((link) => {
          const active = link.href === "/portal" ? pathname === link.href : pathname.startsWith(link.href);
          return <Link className={active ? "portal-nav-link active" : "portal-nav-link"} href={link.href} key={link.href}>
            <span aria-hidden="true">{link.icon}</span>{link.label}
          </Link>;
        })}
      </nav>
      <div className="portal-sidebar-help">
        <span>NEED A HAND?</span>
        <strong>Talk to the team</strong>
        <a href="tel:+61407189087">0407 189 087</a>
      </div>
      <SignOutButton />
    </aside>
  );
}