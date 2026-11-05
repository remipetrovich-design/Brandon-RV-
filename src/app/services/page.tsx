import type { Metadata } from "next";
import Link from "next/link";
import {getPublishedServices,getPublishedSitePage,contentText} from "@/lib/public-site";

export const metadata:Metadata={
  title:"Services",
  description:"Ask Brandon RV about suitable caravan and motorhome interior repair enquiries around Tamworth, NSW."
};

const enquiryCategories=[
  {number:"01",title:"Cabinetry & interior hardware",description:"Ask about minor, non-structural repairs to suitable hinges, latches, runners, doors and trims."},
  {number:"02",title:"Living-area fittings",description:"Discuss suitable handles, catches and interior fittings. The exact task and installation method are checked first."},
  {number:"03",title:"Accessory enquiries",description:"Send the product details and photos. Electrical, plumbing and specialist systems are not assumed to be within scope."},
  {number:"04",title:"Repair assessment",description:"Describe the issue and provide photos so the work, vehicle and location can be reviewed before a visit is discussed."}
];

export default async function ServicesPage() {
  const [page,published]=await Promise.all([getPublishedSitePage("services"),getPublishedServices()]);
  const services=published.length
    ? published.map((service,index)=>({number:String(index+1).padStart(2,"0"),title:service.name,description:service.description??"Contact Brandon RV to discuss whether this work is suitable.",scope_notes:service.scope_notes}))
    : enquiryCategories.map(service=>({...service,scope_notes:null as string|null}));
  const intro=contentText(page?.content,"intro","Brandon RV focuses on suitable caravan and motorhome living-area repair enquiries. Each request is checked against the actual task, vehicle, location, capability and applicable requirements before work is accepted.");
  const heroTitle=contentText(page?.content,"hero_title","Practical help for life on the road.");
  const words=heroTitle.split(/\s+/);
  return (
    <main>
      <section className="page-hero">
        <div className="shell">
          <p className="eyebrow"><span className="eyebrow-line"/> WHAT WE CAN ASSESS</p>
          <h1>{words.slice(0,-2).join(" ")} <em>{words.slice(-2).join(" ")}</em></h1>
          <p>{intro}</p>
        </div>
      </section>
      <section className="content-section">
        <div className="shell">
          <p className="content-intro">{intro}</p>
          <div className="detail-list">
            {services.map(service=>(
              <article className="detail-item" key={service.number}>
                <span>{service.number}</span><h2>{service.title}</h2><p>{service.description}</p>
                {service.scope_notes&&<small className="service-scope-note">{service.scope_notes}</small>}
              </article>
            ))}
          </div>
          <div className="note-panel">
            <p>These categories are not a promise that every task can be accepted. Work proceeds only when it is within the confirmed service scope, demonstrated capability and insurance cover, and can be completed with suitable tools and safe site conditions. Some requests must be referred to a specialist.</p>
          </div>
          <div className="section-link-row"><Link href="/request-quote" className="text-link">Send a service enquiry <span aria-hidden="true">→</span></Link></div>
        </div>
      </section>
    </main>
  );
}
