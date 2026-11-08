import type {Metadata} from "next";
import Link from "next/link";
import {getPublishedSitePage, getPublishedServiceAreas, contentText} from "@/lib/public-site";
export const dynamic="force-dynamic";
export const metadata:Metadata={title:"How it works & Service areas",description:"How Brandon RV reviews enquiries, quotes suitable work and confirms mobile service appointments around Tamworth, NSW."};
const fallback=["Submit an enquiry with your vehicle details, location and a description of the issue.","Brandon RV reviews the request and may ask for photographs or more information.","Receive a quote or inspection proposal with the proposed scope and costs.","Approve the work and any agreed parts or freight costs.","Brandon RV checks availability, access and parts before confirming an appointment.","The work is completed and checked, then the invoice and payment details are provided."];
export default async function HowItWorksPage(){
 const [page,areasPage,areas]=await Promise.all([getPublishedSitePage("how-it-works"),getPublishedSitePage("service-areas"),getPublishedServiceAreas()]);
 const steps=Array.isArray(page?.content.steps)?page.content.steps.filter((x):x is string=>typeof x==="string"):fallback;
 const base=contentText(areasPage?.content,"base","Tamworth NSW");const radius=areas.find(a=>a.radius_km!==null)?.radius_km??null;
 const areaIntro=contentText(areasPage?.content,"intro","Brandon RV is based in the Tamworth region. Tell us where the vehicle is located and we will confirm whether travel is practical before discussing an appointment.");
 return <main>
  <section className="page-hero"><div className="shell"><p className="eyebrow"><span className="eyebrow-line"/> THE CUSTOMER PROCESS</p><h1>From enquiry to <em>handover.</em></h1><p>{contentText(page?.content,"intro","A clear process helps confirm the right work, the right parts and a suitable time before a mobile visit is booked.")}</p></div></section>
  <section className="content-section"><div className="shell"><div className="detail-list">{steps.map((step,i)=><article className="detail-item" key={i}><span>{String(i+1).padStart(2,"0")}</span><h2>{["Tell us what is happening","Review the request","Receive your quote","Approve the work","Confirm the visit","Complete and hand over"][i]??"Next step"}</h2><p>{step}</p></article>)}</div><div className="note-panel"><p>An appointment request is not a confirmed booking. Brandon RV confirms the time after checking job scope, travel, availability, access and any required parts.</p></div></div></section>
  <section id="service-areas" className="content-section brv-combined-areas"><div className="shell service-area-grid">
   <div><p className="eyebrow"><span className="eyebrow-line"/> WHERE WE WORK</p><h2>Mobile service around <em>Tamworth.</em></h2><p>{areaIntro}</p><p>Tell us where your caravan or motorhome is located and what work you need. We will confirm whether the job and travel are suitable before arranging a visit.{radius? ` The currently published local service radius is ${radius} km.`:""}</p><p>Travel outside the usual local area may be possible by arrangement and can involve additional travel charges.</p><Link className="button button-primary" href="/request-quote">Check your location <span>→</span></Link></div>
   <div className="service-area-card"><span>BRANDON RV</span><strong>{base}</strong><small>{areas.length?areas.map(area=>[area.name,...(area.suburbs??[]),...(area.postcodes??[]),area.travel_fee!==null?"Travel $"+Number(area.travel_fee).toFixed(2):""].filter(Boolean).join(" — ")).join(" · "):"LOCAL MOBILE SERVICE"}</small><div className="service-area-ring"/></div>
  </div></section>
 </main>;
}
