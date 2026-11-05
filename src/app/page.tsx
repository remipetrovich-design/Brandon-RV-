import Link from "next/link";
import {getPublishedServices,getPublishedSitePage,getPublicBusiness,contentText,phoneHref} from "@/lib/public-site";
export const dynamic="force-dynamic";

const enquiryCategories = [
  {
    title: "Cabinetry & interior hardware",
    description: "Ask about minor, non-structural repairs to suitable hinges, latches, runners, doors and trims."
  },
  {
    title: "Living-area fittings",
    description: "Discuss suitable handles, catches and interior fittings. The exact installation requirements are checked first."
  },
  {
    title: "Accessory enquiries",
    description: "Send the product details and photos. Electrical, plumbing and specialist systems are not assumed to be within scope."
  }
];

export default async function HomePage() {
  const [page,business,publishedServices]=await Promise.all([
    getPublishedSitePage("home"),
    getPublicBusiness(),
    getPublishedServices()
  ]);
  const phone=business.phone??"0407 189 087";
  const callLink=phoneHref(phone);
  const location=[business.city,business.region].filter(Boolean).join(", ")||"Tamworth, NSW";
  const services=publishedServices.length
    ? publishedServices.slice(0,3).map(service=>({
        title:service.name,
        description:service.description??service.scope_notes??"Contact Brandon RV to discuss whether this work is suitable."
      }))
    : enquiryCategories;
  const heroTitle=contentText(page?.content,"hero_title","Caravan repairs, without the workshop trip.");
  const intro=contentText(page?.content,"intro","Mobile caravan and motorhome interior repair enquiries around Tamworth, NSW. Each request is reviewed before work is accepted, with the scope, location, capability and availability checked first.");
  const brandLine=contentText(page?.content,"hero_subtitle",business.brand_line??"From Factory Experience to Repairs On The Go");
  const primaryAction=contentText(page?.content,"primary_action","Request a quote");

  return (
    <main className="public-home">
      <section className="home-hero">
        <div className="shell home-hero-grid">
          <div className="home-hero-copy">
            <p className="home-eyebrow"><span /> MOBILE CARAVAN & MOTORHOME SERVICE</p>
            <h1>{heroTitle}</h1>
            <p className="home-hero-intro">{intro}</p>
            <div className="home-hero-actions">
              <Link className="button button-primary" href="/request-quote">{primaryAction}<span aria-hidden="true">→</span></Link>
              <a className="button button-secondary" href={callLink}>Call {phone}</a>
            </div>
            <div className="home-hero-meta">
              <span><i aria-hidden="true" /> Based in {location}</span>
              <span>Appointments confirmed after review</span>
            </div>
            {business.status==="prelaunch"&&<div className="home-launch-note"><strong>Pre-launch</strong><span>Enquiries can be submitted for assessment. No booking or work is confirmed until the service scope, approvals, insurance and operating readiness are in place.</span></div>}
          </div>
          <aside className="home-hero-panel" aria-label="Brandon RV mobile service">
            <div className="home-panel-top"><span>BRANDON RV</span><span>REPAIRS ON THE GO</span></div>
            <div className="home-panel-mark"><img src="/brv-mark.webp" alt="Brandon RV" /></div>
            <p className="home-panel-kicker">FROM FACTORY EXPERIENCE</p>
            <h2>Practical help for the inside of your RV.</h2>
            <p>Clear communication, itemised quotes and suitable work assessed at your location.</p>
            <div className="home-panel-bottom"><span>TAMWORTH, NSW</span><span>MOBILE · BY APPOINTMENT</span></div>
          </aside>
        </div>
      </section>

      <section className="quick-facts">
        <div className="shell facts-grid">
          <div><span className="fact-index">01</span><strong>Mobile by appointment</strong><small>Suitable work assessed at your location</small></div>
          <div><span className="fact-index">02</span><strong>Scope checked first</strong><small>No work proceeds without agreed approval</small></div>
          <div><span className="fact-index">03</span><strong>Tamworth, NSW</strong><small>Ask about regional travel</small></div>
        </div>
      </section>

      <section className="section services-section">
        <div className="shell">
          <div className="section-heading">
            <div>
              <p className="eyebrow"><span className="eyebrow-line" /> WHAT YOU CAN ASK ABOUT</p>
              <h2>Small details.<br /><em>Better journeys.</em></h2>
            </div>
            <p className="section-lead">Brandon RV is focused on suitable caravan and motorhome living-area repairs and accessory enquiries. Every request is assessed individually before it is accepted.</p>
          </div>
          <div className="service-grid">
            {services.map((service,index)=>(
              <article className="service-card" key={service.title}>
                <span className="service-number">{String(index+1).padStart(2,"0")}</span>
                <span className="service-arrow" aria-hidden="true">↗</span>
                <h3>{service.title}</h3>
                <p>{service.description}</p>
              </article>
            ))}
          </div>
          <div className="service-note">
            <strong>Important service boundaries</strong>
            <p>Work is only accepted when it is within the confirmed service scope, demonstrated capability and insurance cover, and can be completed with suitable tools and safe site conditions. Some work must be referred to a specialist.</p>
          </div>
          <div className="section-link-row"><Link href="/services" className="text-link">Explore service information <span aria-hidden="true">→</span></Link></div>
        </div>
      </section>

      <section className="process-section">
        <div className="shell process-grid">
          <div className="process-heading">
            <p className="eyebrow eyebrow-light"><span className="eyebrow-line" /> A CLEAR PROCESS</p>
            <h2>Know what happens<br /><em>before work begins.</em></h2>
            <p>Requests are reviewed before a visit is confirmed. You will know the proposed scope, pricing and next step before work proceeds.</p>
            <Link href="/how-it-works" className="button button-light">How it works <span aria-hidden="true">→</span></Link>
          </div>
          <div className="process-steps">
            <div><span>01</span><div><h3>Send the details</h3><p>Tell us about the vehicle, location and issue. Photos help explain the work.</p></div></div>
            <div><span>02</span><div><h3>Scope is reviewed</h3><p>The task, capability, site conditions and any specialist requirements are checked.</p></div></div>
            <div><span>03</span><div><h3>Quote and approval</h3><p>Receive an itemised quote or inspection proposal and approve the agreed work.</p></div></div>
            <div><span>04</span><div><h3>Visit and handover</h3><p>A suitable appointment is confirmed once availability and any required parts are ready.</p></div></div>
          </div>
        </div>
      </section>

      <section className="contact-strip">
        <div className="shell contact-strip-inner">
          <div><p className="eyebrow"><span className="eyebrow-line" /> HAVE A JOB IN MIND?</p><h2>Start with a <em>conversation.</em></h2><p>Share the details and find out whether the work is suitable.</p></div>
          <div className="contact-strip-action">
            <Link className="button button-primary" href="/request-quote">Request a quote <span aria-hidden="true">→</span></Link>
            <a href={callLink}>Or call {phone}</a>
          </div>
        </div>
      </section>
    </main>
  );
}
