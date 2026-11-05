import type { Metadata } from "next";
import Link from "next/link";
import {getPublishedServices,getPublishedSitePage,contentText} from "@/lib/public-site";

export const metadata: Metadata = {
  title: "Services",
  description: "Caravan and motorhome interior repairs, hardware and selected accessories from Brandon RV in Tamworth, NSW."
};

const fallbackServiceDetails = [
  {
    number: "01",
    title: "Cabinetry & interior repairs",
    description: "Minor interior repairs and adjustments, including cupboard doors, drawer fronts, hinges, latches and runners."
  },
  {
    number: "02",
    title: "Interior hardware & fittings",
    description: "Help with selected handles, catches, trims and other interior fittings that have become worn, loose or damaged."
  },
  {
    number: "03",
    title: "Accessory installation",
    description: "Selected caravan and motorhome interior accessories and practical upgrades. The product and installation requirements are checked before work is accepted."
  },
  {
    number: "04",
    title: "Fault assessment",
    description: "Discuss an interior issue, provide photos and details, and confirm whether it is suitable for a mobile repair visit."
  }
];

export default async function ServicesPage() {
  const [page,published]=await Promise.all([getPublishedSitePage("services"),getPublishedServices()]);
  const serviceDetails=published.length?published.map((s,i)=>({number:String(i+1).padStart(2,"0"),title:s.name,description:s.description??"Contact Brandon RV to confirm the work required.",scope_notes:s.scope_notes})):fallbackServiceDetails.map(s=>({...s,scope_notes:null as string|null}));
  const intro=contentText(page?.content,"intro","The work is focused on suitable caravan and motorhome interior jobs. Each enquiry is reviewed against the repair required, the vehicle, the location and the parts or equipment needed.");
  const heroTitle=contentText(page?.content,"hero_title","Practical help for life on the road.");
  const words=heroTitle.split(/\s+/);
  return (
    <main>
      <section className="page-hero">
        <div className="shell">
          <p className="eyebrow"><span className="eyebrow-line" /> BRANDON RV SERVICES</p>
          <h1>{words.slice(0,-2).join(" ")} <em>{words.slice(-2).join(" ")}</em></h1>
          <p>{intro}</p>
        </div>
      </section>
      <section className="content-section">
        <div className="shell">
          <p className="content-intro">{intro}</p>
          <div className="detail-list">
            {serviceDetails.map((service) => (
              <article className="detail-item" key={service.number}>
                <span>{service.number}</span>
                <h2>{service.title}</h2>
                <p>{service.description}</p>{service.scope_notes&&<small className="service-scope-note">{service.scope_notes}</small>}
              </article>
            ))}
          </div>
          <div className="note-panel">
            <p>Not sure whether your job is covered? Contact Brandon RV with a description and photos. Some work may need to be referred to a suitably qualified specialist. A booking is only confirmed after the job scope and availability have been checked.</p>
          </div>
          <div className="section-link-row"><Link href="/contact" className="text-link">Enquire about a job <span aria-hidden="true">→</span></Link></div>
        </div>
      </section>
    </main>
  );
}