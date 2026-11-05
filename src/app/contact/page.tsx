import type { Metadata } from "next";
import {getPublicBusiness,phoneHref,getPublishedSitePage,contentText} from "@/lib/public-site";

export const metadata: Metadata = {
  title: "Contact",
  description: "Contact Brandon RV in Tamworth, NSW about caravan and motorhome interior repairs and accessories."
};

export default function ContactPage() {
  return (
    <main>
      <section className="page-hero">
        <div className="shell">
          <p className="eyebrow"><span className="eyebrow-line" /> CONTACT BRANDON RV</p>
          <h1>Tell us what needs <em>attention.</em></h1>
          <p>{intro}</p>
        </div>
      </section>
      <section className="content-section">
        <div className="shell contact-grid">
          <div className="contact-guidance">
            <h2>Make the first step simple.</h2>
            <p>When you get in touch, it helps to have the caravan or motorhome make and model, your location, a description of the issue and a few clear photos.</p>
            <p>Enquiries are assessed before a booking is confirmed. Availability, parts, access and the work required all need to be checked first.</p>
          </div>
          <div className="contact-card">
            <span>Call Chris</span>
            <strong><a href={callLink}>{phone}</a></strong>
            <p>Mobile service based in {[business.city,business.region].filter(Boolean).join(" ")||"Tamworth NSW"}. Contact us to discuss your location and the job you need done.</p>
            <span>Service area</span>
            <strong>Tamworth & surrounds</strong>
            <p>Travel outside the usual local area can be discussed when you enquire.</p>
          </div>
        </div>
      </section>
    </main>
  );
}