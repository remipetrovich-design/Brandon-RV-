import type {Metadata} from "next";
import Link from "next/link";
import PublicSiteBuilder from "@/components/public-site-builder";
import {getPublishedServices,getPublishedServiceAreas,getPublishedSitePage,contentText} from "@/lib/public-site";
export const dynamic="force-dynamic";
export const metadata:Metadata={title:"About & Services",description:"Learn about Brandon RV and the caravan and motorhome repair services available around Tamworth, NSW."};
export default async function AboutServicesPage(){
 const [about,servicesPage,published,areas]=await Promise.all([getPublishedSitePage("about"),getPublishedSitePage("services"),getPublishedServices(),getPublishedServiceAreas()]);
 const hasAboutBuilder=Boolean(about?.content?.builder);const hasServicesBuilder=Boolean(servicesPage?.content?.builder);
 const intro=contentText(about?.content,"intro","Brandon RV provides mobile caravan and motorhome repair and accessory services around Tamworth, NSW.");
 const aboutTitle=about?.title??"Experience that understands your setup.";
 const serviceIntro=contentText(servicesPage?.content,"intro","Explore the services Brandon RV offers. Contact us to discuss your requirements and arrange the next step.");
 const serviceTitle=contentText(servicesPage?.content,"hero_title","Practical help for life on the road.");
 const items=published.map((item,index)=>({number:String(index+1).padStart(2,"0"),title:item.name,description:item.description??"Contact Brandon RV to discuss this service.",scope_notes:item.scope_notes,price:item.pricing_label||(item.price_from!==null?"From $"+Number(item.price_from).toFixed(2)+" AUD":"")}));
 const aboutWords=aboutTitle.split(/\s+/);const serviceWords=serviceTitle.split(/\s+/);
 const aboutSection=hasAboutBuilder
  ? <PublicSiteBuilder data={about!.content.builder} services={published} areas={areas}/>
  : <><section className="page-hero"><div className="shell"><p className="eyebrow"><span className="eyebrow-line"/> ABOUT BRANDON RV</p><h1>{aboutWords.slice(0,-2).join(" ")} <em>{aboutWords.slice(-2).join(" ")}</em></h1><p>{intro}</p></div></section>
    <section className="content-section"><div className="shell about-grid"><aside className="about-aside"><strong>From Factory Experience to Repairs On The Go.</strong><p>Mobile caravan and motorhome repairs · Tamworth NSW</p></aside><div className="about-copy"><h2>A practical approach to mobile RV repairs.</h2><p>Brandon RV brings practical caravan and motorhome industry experience to mobile repair and accessory work.</p><p>Tell us what you need, provide the vehicle details and photographs where possible, and we will discuss the job and the next step.</p></div></div></section></>;
 const servicesSection=hasServicesBuilder
  ? <PublicSiteBuilder data={servicesPage!.content.builder} services={published} areas={areas}/>
  : <section className="content-section brv-combined-services"><div className="shell"><div className="section-heading"><div><p className="eyebrow"><span className="eyebrow-line"/> OUR SERVICES</p><h2>{serviceWords.slice(0,-2).join(" ")} <em>{serviceWords.slice(-2).join(" ")}</em></h2></div><p className="section-lead">{serviceIntro}</p></div>
    {items.length?<div className="detail-list">{items.map(item=><article className="detail-item" key={item.number}><span>{item.number}</span><h2>{item.title}</h2><p>{item.description}</p>{item.price&&<strong className="service-price">{item.price}</strong>}{item.scope_notes&&<small className="service-scope-note">{item.scope_notes}</small>}</article>)}</div>:<p>Service information is being updated. Contact Brandon RV to discuss your requirements.</p>}
    <div className="section-link-row"><Link href="/request-quote" className="text-link">Ask about a job <span aria-hidden="true">→</span></Link></div></div></section>;
 return <main>{aboutSection}{servicesSection}</main>;
}
