import Link from "next/link";
import {getPublishedServices,getPublishedSitePage,getPublicBusiness,contentText,phoneHref} from "@/lib/public-site";
export const dynamic="force-dynamic";

const fallbackServices = [
  {
    number: "01",
    title: "Cabinetry & interior repairs",
    description: "Help with cupboard doors, drawers, hinges, latches, runners and other minor interior repairs."
  },
  {
    number: "02",
    title: "Hardware & fittings",
    description: "Replacement and adjustment of selected handles, catches, trims and interior fittings."
  },
  {
    number: "03",
    title: "Interior accessories",
    description: "Practical accessory upgrades for caravan and motorhome living spaces, assessed job by job."
  }
];

export default async function HomePage() {
  const [page,business,publishedServices]=await Promise.all([getPublishedSitePage("home"),getPublicBusiness(),getPublishedServices()]);
  const phone=business.phone??"0407 189 087";
  const callLink=phoneHref(phone);
  const location=[business.city,business.region].filter(Boolean).join(" ")||"Tamworth NSW";
  const services=publishedServices.length?publishedServices.slice(0,3).map((s,i)=>({number:String(i+1).padStart(2,"0"),title:s.name,description:s.description??s.scope_notes??"Contact Brandon RV to confirm whether this work is suitable."})):fallbackServices;
  const heroTitle=contentText(page?.content,"hero_title","Keep your next adventure moving.");
  const heroWords=heroTitle.split(/\s+/);
  const heroLead=heroWords.slice(0,-1).join(" ");
  const heroLast=heroWords.at(-1)??"";
  const heroIntro=contentText(page?.content,"intro","{heroIntro}");
  const heroSubtitle=contentText(page?.content,"hero_subtitle","From Factory Experience to Repairs On The Go.");
  const primaryAction=contentText(page?.content,"primary_action","Request a quote");
  return (
    <main>
      <section className="hero">
        <div className="shell hero-grid">
          <div className="hero-copy">
            <p className="eyebrow"><span className="eyebrow-line" /> MOBILE CARAVAN & MOTORHOME SERVICE</p>
            <h1>{heroLead} <em>{heroLast}</em></h1>
            <p className="hero-intro">
              Practical caravan and motorhome interior repairs, fittings and accessories — with mobile service around Tamworth, NSW.
            </p>
            <div className="hero-actions">
              <a className="button button-primary" href={callLink}>Call {phone} <span aria-hidden="true">↗</span></a>
              <Link className="button button-secondary" href="/services">Explore services</Link>
              <Link className="button button-secondary" href="/request-quote">{primaryAction}</Link>
            </div>
            <p className="hero-note">{heroSubtitle}</p>
          </div>

          <div className="hero-art" aria-label="Brandon RV mobile caravan service">
            <div className="art-topline"><span>BRANDON RV</span><span>TAMWORTH · NSW</span></div>
            <div className="art-circle art-circle-one" />
            <div className="art-circle art-circle-two" />
            <div className="art-route"><span>ON THE ROAD</span><i /></div>
            <div className="art-card">
              <span className="art-card-label">MOBILE SERVICE</span>
              <strong>Repairs<br />that come<br /><em>to you.</em></strong>
              <span className="art-card-foot">CARAVANS / MOTORHOMES</span>
            </div>
            <div className="art-stamp">BR<br /><small>RV</small></div>
            <div className="art-bottomline"><span>01 — 03</span><span>READY FOR THE ROAD</span></div>
          </div>
        </div>
        <div className="hero-edge" />
      </section>

      <section className="quick-facts">
        <div className="shell facts-grid">
          <div><span className="fact-index">01</span><strong>Mobile service</strong><small>Work is assessed at your location</small></div>
          <div><span className="fact-index">02</span><strong>Interior-focused</strong><small>Repairs, hardware and accessories</small></div>
          <div><span className="fact-index">03</span><strong>Tamworth, NSW</strong><small>Ask about service in your area</small></div>
        </div>
      </section>

      <section className="section services-section">
        <div className="shell">
          <div className="section-heading">
            <div>
              <p className="eyebrow"><span className="eyebrow-line" /> WHAT WE DO</p>
              <h2>Small repairs.<br /><em>More time away.</em></h2>
            </div>
            <p className="section-lead">From worn fittings to everyday interior issues, Brandon RV focuses on practical work that helps keep your caravan or motorhome ready to use.</p>
          </div>
          <div className="service-grid">
            {services.map((service) => (
              <article className="service-card" key={service.number}>
                <span className="service-number">{service.number}</span>
                <div className="service-arrow" aria-hidden="true">↗</div>
                <h3>{service.title}</h3>
                <p>{service.description}</p>
              </article>
            ))}
          </div>
          <div className="section-link-row">
            <Link href="/services" className="text-link">View service details <span aria-hidden="true">→</span></Link>
          </div>
        </div>
      </section>

      <section className="process-section">
        <div className="shell process-grid">
          <div className="process-heading">
            <p className="eyebrow eyebrow-light"><span className="eyebrow-line" /> HOW IT WORKS</p>
            <h2>Clear from<br /><em>the start.</em></h2>
            <p>Every job is reviewed before it is booked, so the work, location and requirements are understood upfront.</p>
          </div>
          <div className="process-steps">
            <div><span>01</span><div><h3>Tell us what is happening</h3><p>Call with a description of the issue, your location and the caravan or motorhome details.</p></div></div>
            <div><span>02</span><div><h3>Confirm the scope</h3><p>We assess whether the work is suitable and discuss the next step, parts and pricing.</p></div></div>
            <div><span>03</span><div><h3>Arrange the visit</h3><p>A booking is confirmed once the job requirements and availability have been checked.</p></div></div>
          </div>
        </div>
      </section>

      <section className="contact-strip">
        <div className="shell contact-strip-inner">
          <div><p className="eyebrow"><span className="eyebrow-line" /> HAVE A JOB IN MIND?</p><h2>Let’s get it <em>sorted.</em></h2></div>
          <div className="contact-strip-action"><a className="button button-dark" href={callLink}>Call Chris · {phone} <span aria-hidden="true">↗</span></a><span>Based in {location}</span></div>
        </div>
      </section>
    </main>
  );
}