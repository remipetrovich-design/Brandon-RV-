import Link from "next/link";
import PublicSiteBuilder from "@/components/public-site-builder";
import {getPublishedServices,getPublishedSitePage,getPublicBusiness,getPublicBusinessSettings,getPublishedServiceAreas,contentText,phoneHref} from "@/lib/public-site";
export const dynamic="force-dynamic";

function CaravanIllustration(){
  return <svg viewBox="0 0 520 250" role="img" aria-label="Illustration of a caravan ready for a mobile service visit">
    <path d="M24 202h470" stroke="#91aaa9" strokeWidth="3" strokeLinecap="round"/>
    <path d="M68 183V97q0-13 13-13h255q29 0 42 27l23 47v25H68Z" fill="#fff" stroke="#173f62" strokeWidth="5" strokeLinejoin="round"/>
    <path d="M337 84h-36v99h74v-25l-23-47q-5-13-15-27Z" fill="#e9f3f7" stroke="#173f62" strokeWidth="4" strokeLinejoin="round"/>
    <path d="M83 105h112v64H83zM208 105h102v64H208z" fill="#c6e0ed" stroke="#173f62" strokeWidth="4"/>
    <path d="M91 112h96M216 112h86" stroke="#fff" strokeWidth="5" opacity=".8"/>
    <path d="M68 183h358M426 183h28l24 13" stroke="#173f62" strokeWidth="5" strokeLinecap="round"/>
    <path d="M115 183a22 22 0 1 0 44 0M339 183a22 22 0 1 0 44 0" fill="#fff" stroke="#173f62" strokeWidth="5"/>
    <circle cx="137" cy="183" r="8" fill="#8da6b5"/><circle cx="361" cy="183" r="8" fill="#8da6b5"/>
    <path d="M80 84V69h45" stroke="#1767ad" strokeWidth="5" strokeLinecap="round"/>
    <path d="M432 157h22" stroke="#e4ad57" strokeWidth="7" strokeLinecap="round"/>
    <path d="M62 202h410" stroke="#a5b9b5" strokeWidth="2" strokeDasharray="5 8"/>
    <circle cx="428" cy="52" r="18" fill="#f7dca8"/><path d="M32 65q20-19 40 0M56 49q20-19 40 0" stroke="#fff" strokeWidth="4" fill="none" strokeLinecap="round"/>
  </svg>;
}

export default async function HomePage() {
  const [page,business,publishedServices,publishedAreas,businessSettings]=await Promise.all([getPublishedSitePage("home"),getPublicBusiness(),getPublishedServices(),getPublishedServiceAreas(),getPublicBusinessSettings()]);
  const builder=page?.content?.builder;
  if(builder&&typeof builder==="object")return <main className="public-home"><PublicSiteBuilder data={builder} services={publishedServices} areas={publishedAreas}/></main>;
  const phone=business.phone??"";
  const callLink=phoneHref(phone);
  const location=[business.city,business.region].filter(Boolean).join(", ")||"Tamworth, NSW";
  const services=publishedServices.slice(0,3).map(service=>({title:service.name,description:service.description??service.scope_notes??"Contact Brandon RV to discuss this service."}));
  const heroTitle=contentText(page?.content,"hero_title","Caravan repairs, without the workshop trip.");
  const intro=contentText(page?.content,"intro","Mobile caravan and motorhome repair and accessory services around Tamworth, NSW. Tell us what you need and we will discuss the best way forward.");
  const primaryAction=contentText(page?.content,"primary_action","Request a quote");
  const brandLine=business.brand_line??"From Factory Experience to Repairs On The Go";

  return <main className="public-home">
    <section className="home-hero">
      <div className="shell home-hero-grid">
        <div className="home-hero-copy">
          <p className="home-eyebrow"><span/> MOBILE CARAVAN & MOTORHOME SERVICE</p>
          <h1>{heroTitle}</h1>
          <p className="home-hero-intro">{intro}</p>
          <div className="home-hero-actions">
            {businessSettings.accepting_enquiries?<Link className="button button-primary" href="/request-quote">{primaryAction}<span aria-hidden="true">→</span></Link>:<span className="button button-secondary" aria-disabled="true">Enquiries temporarily unavailable</span>}
            {phone&&<a className="button button-secondary" href={callLink}>Call {phone}</a>}
          </div>
          <div className="home-hero-meta">
            <span><i aria-hidden="true"/> Based in {location}</span>
            <span><i aria-hidden="true"/> Mobile visits by appointment</span>
            <span><i aria-hidden="true"/> Scope checked before acceptance</span>
          </div>
          {business.status==="prelaunch"&&<div className="home-launch-note"><strong>Pre-launch</strong><span>Brandon RV is preparing to launch. You can still contact Chris to discuss your requirements.</span></div>}
        </div>
        <aside className="home-hero-panel" aria-label="Brandon RV mobile caravan service">
          <div className="home-panel-top"><span>BRANDON RV</span><span>MOBILE SERVICE · NSW</span></div>
          <div className="home-scene"><CaravanIllustration/></div>
          <div className="home-scene-caption"><span>ON-SITE SERVICE</span><span>BY APPOINTMENT</span></div>
          <p className="home-panel-kicker">{brandLine.toUpperCase()}</p>
          <h2>Practical help for the inside of your RV.</h2>
          <p>Clear communication, itemised quotes and suitable work assessed at your location.</p>
          <div className="home-panel-bottom"><span>TAMWORTH, NSW</span><span>REPAIRS ON THE GO</span></div>
        </aside>
      </div>
    </section>

    <section className="quick-facts"><div className="shell facts-grid">
      <div><span className="fact-index">01</span><strong>Mobile by appointment</strong><small>Suitable work assessed at your location</small></div>
      <div><span className="fact-index">02</span><strong>Scope checked first</strong><small>No work proceeds without agreed approval</small></div>
      <div><span className="fact-index">03</span><strong>Tamworth, NSW</strong><small>Ask about regional travel</small></div>
    </div></section>

    <section className="section services-section"><div className="shell">
      <div className="section-heading"><div><p className="eyebrow"><span className="eyebrow-line"/> OUR SERVICES</p><h2>Services that keep you<br/><em>more time on the road.</em></h2></div><p className="section-lead">These are the services Brandon RV currently offers. Contact Chris to discuss your requirements or ask about something not listed.</p></div>
      {services.length?<div className="service-grid">{services.map((service,index)=><article className="service-card" key={service.title}><span className="service-number">{String(index+1).padStart(2,"0")}</span><span className="service-arrow" aria-hidden="true">↗</span><h3>{service.title}</h3><p>{service.description}</p></article>)}</div>:<p>Our service list is being updated. Contact Chris to discuss what you need.</p>}
      <div className="section-link-row"><Link href="/services" className="text-link">Explore service information <span aria-hidden="true">→</span></Link></div>
    </div></section>

    <section className="process-section"><div className="shell process-grid">
      <div className="process-heading"><p className="eyebrow eyebrow-light"><span className="eyebrow-line"/> A CLEAR PROCESS</p><h2>Know what happens<br/><em>before work begins.</em></h2><p>Requests are reviewed before a visit is confirmed. You will know the proposed scope, pricing and next step before work proceeds.</p><Link href="/how-it-works" className="button button-light">How it works <span aria-hidden="true">→</span></Link></div>
      <div className="process-steps">
        <div><span>01</span><div><h3>Send the details</h3><p>Tell us about the vehicle, location and issue. Photos help explain the work.</p></div></div>
        <div><span>02</span><div><h3>Scope is reviewed</h3><p>Chris reviews the details and confirms the best way to proceed.</p></div></div>
        <div><span>03</span><div><h3>Quote and approval</h3><p>Receive an itemised quote or inspection proposal and approve the agreed work.</p></div></div>
        <div><span>04</span><div><h3>Visit and handover</h3><p>A suitable appointment is confirmed once availability and any required parts are ready.</p></div></div>
      </div>
    </div></section>

    <section className="home-value-section"><div className="shell">
      <div className="section-heading"><div><p className="eyebrow"><span className="eyebrow-line"/> THE BRANDON RV APPROACH</p><h2>Practical, clear<br/><em>and considered.</em></h2></div><p className="section-lead">The aim is to make caravan and motorhome repairs easier to organise, with clear communication from first enquiry through to completion.</p></div>
      <div className="home-value-grid">
        <article className="home-value-card"><span>01</span><h3>Understand the issue</h3><p>Vehicle details, photos and a clear description help identify the right next step.</p></article>
        <article className="home-value-card"><span>02</span><h3>Agree before work</h3><p>Scope, costs, parts and any changes are discussed and approved before work proceeds.</p></article>
        <article className="home-value-card"><span>03</span><h3>Straightforward updates</h3><p>Chris keeps you informed about the job, timing and next steps.</p></article>
      </div>
    </div></section>

    <section className="home-final-cta"><div className="shell home-final-cta-inner">
      <div><p className="eyebrow"><span className="eyebrow-line"/> HAVE A JOB IN MIND?</p><h2>Start with the details. We’ll help work out the next step.</h2><p>Share your vehicle, location and what needs attention.</p></div>
      <div className="home-final-cta-actions">{businessSettings.accepting_enquiries?<Link className="button button-primary" href="/request-quote">Request a quote <span aria-hidden="true">→</span></Link>:<span className="button button-secondary" aria-disabled="true">Enquiries temporarily unavailable</span>}<Link className="button button-secondary" href="/faq">Read the FAQs</Link></div>
    </div></section>
  </main>;
}
