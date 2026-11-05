import type {Metadata} from "next";
import Link from "next/link";
import {getPublishedServices,getPublishedSitePage,contentText} from "@/lib/public-site";
export const dynamic="force-dynamic";
export const metadata:Metadata={title:"About & Services",description:"Learn about Brandon RV and the caravan and motorhome interior repair enquiries it can assess around Tamworth, NSW."};
const fallback=[
 {title:"Cabinetry & interior hardware",description:"Ask about minor, non-structural repairs to suitable hinges, latches, runners, doors and trims."},
 {title:"Living-area fittings",description:"Discuss suitable handles, catches and interior fittings. The exact task and installation method are checked first."},
 {title:"Accessory enquiries",description:"Send the product details and photos. Electrical, plumbing and specialist systems are not assumed to be within scope."},
 {title:"Repair assessment",description:"Describe the issue and provide photos so the work, vehicle and location can be reviewed before a visit is discussed."}
];
export default async function AboutServicesPage(){
 const [about,servicesPage,published]=await Promise.all([getPublishedSitePage("about"),getPublishedSitePage("services"),getPublishedServices()]);
 const intro=contentText(about?.content,"intro","Brandon RV is being developed as a mobile, appointment-based service for suitable caravan and motorhome interior repair and accessory enquiries around Tamworth, NSW.");
 const aboutTitle=about?.title??"Experience that understands your setup.";
 const serviceIntro=contentText(servicesPage?.content,"intro","Brandon RV focuses on suitable caravan and motorhome living-area repair enquiries. Each request is checked against the actual task, vehicle, location, capability and applicable requirements before work is accepted.");
 const serviceTitle=contentText(servicesPage?.content,"hero_title","Practical help for life on the road.");
 const items=published.length?published.map((item,index)=>({number:String(index+1).padStart(2,"0"),title:item.name,description:item.description??"Contact Brandon RV to discuss whether this work is suitable.",scope_notes:item.scope_notes})):fallback.map((item,index)=>({...item,number:String(index+1).padStart(2,"0"),scope_notes:null as string|null}));
 const aboutWords=aboutTitle.split(/\s+/);const serviceWords=serviceTitle.split(/\s+/);
 return <main>
  <section className="page-hero"><div className="shell"><p className="eyebrow"><span className="eyebrow-line"/> ABOUT BRANDON RV</p><h1>{aboutWords.slice(0,-2).join(" ")} <em>{aboutWords.slice(-2).join(" ")}</em></h1><p>{intro}</p></div></section>
  <section className="content-section"><div className="shell about-grid">
   <aside className="about-aside"><strong>From Factory Experience to Repairs On The Go.</strong><p>Mobile caravan and motorhome interior repair enquiries · Tamworth NSW</p></aside>
   <div className="about-copy"><h2>A practical approach to mobile RV repairs.</h2>
    <p>Chris's business plan records experience in motorhome manufacturing at Trakka, including a B-Class production team leadership role, and caravan parts, customer service and repair coordination at Tow World. It also records a Certificate II in automotive servicing. These are owner-reported credentials and should be supported by employment and qualification evidence before publication.</p>
    <p>That background informs the intended business approach: understand the issue, check the exact scope, explain the options and agree on the next step before work begins.</p>
    <p>Experience or a qualification does not automatically authorise regulated work. Each request is assessed against the actual task, demonstrated capability, applicable permissions, insurance, tools and customer-site conditions. Work outside the confirmed scope is declined or referred to an appropriately qualified specialist.</p>
   </div>
  </div></section>
  <section className="content-section brv-combined-services"><div className="shell">
   <div className="section-heading"><div><p className="eyebrow"><span className="eyebrow-line"/> WHAT WE CAN ASSESS</p><h2>{serviceWords.slice(0,-2).join(" ")} <em>{serviceWords.slice(-2).join(" ")}</em></h2></div><p className="section-lead">{serviceIntro}</p></div>
   <div className="detail-list">{items.map(item=><article className="detail-item" key={item.number}><span>{item.number}</span><h2>{item.title}</h2><p>{item.description}</p>{item.scope_notes&&<small className="service-scope-note">{item.scope_notes}</small>}</article>)}</div>
   <div className="note-panel"><p>These categories are not a promise that every task can be accepted. Work proceeds only when it is within the confirmed service scope, demonstrated capability and insurance cover, and can be completed with suitable tools and safe site conditions. Some requests must be referred to a specialist.</p></div>
   <div className="section-link-row"><Link href="/request-quote" className="text-link">Ask about a job <span aria-hidden="true">→</span></Link></div>
  </div></section>
 </main>;
}
