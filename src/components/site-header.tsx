import Link from "next/link";

const navigation = [
  { href: "/", label: "Home" },
  { href: "/services", label: "Services" },\n  { href: "/service-areas", label: "Service areas" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" }
];

export default function SiteHeader() {
  return (
    <header className="site-header">
      <div className="shell header-inner">
        <Link href="/" className="brand" aria-label="Brandon RV home">
          <span className="brand-mark" aria-hidden="true">BR</span>
          <span className="brand-name">
            <strong>BRANDON <span>RV</span></strong>
            <small>REPAIRS ON THE GO</small>
          </span>
        </Link>
        <nav className="main-nav" aria-label="Main navigation">
          {navigation.map((item) => <Link href={item.href} key={item.href}>{item.label}</Link>)}
        </nav>
        <div className="header-actions">
          <Link className="header-portal-link" href="/portal/sign-in">Customer portal</Link>
          <a className="header-call" href="tel:+61407189087"><span>Call Chris</span><strong>0407 189 087</strong></a>
        </div>
      </div>
    </header>
  );
}