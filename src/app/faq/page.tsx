import type {Metadata} from "next";
import PublicSiteBuilder from "@/components/public-site-builder";
import {getPublishedSitePage,contentText} from "@/lib/public-site";
export const dynamic="force-dynamic";
export const metadata:Metadata={title:"Frequently asked questions",description:"Answers about Brandon RV mobile caravan and motorhome interior repair services."};
const fallback=[
 {question:"Where does Brandon RV work?",answer:"Brandon RV is based in Tamworth NSW. Tell us where the vehicle is located so travel and job suitability can be checked. The proposed local radius is still subject to validation."},
 {question:"What work can I request?",answer:"The launch focus is minor non-structural cabinetry repairs, interior hardware and suitable living-area fittings. Other work is considered only after the exact task, capability, legal requirements and insurance cover have been checked."},
 {question:"Do you repair engines, brakes, gas or 240V electrical systems?",answer:"These services are not part of the launch menu. Motorhome mechanical work, gas work, 240V electrical work, structural repairs and other specialist work must be referred to an appropriately qualified provider."},
 {question:"Is my appointment confirmed when I submit a request?",answer:"No. An online request is a preferred time only. Brandon RV checks the work, location, access, parts and availability before confirming an appointment."},
 {question:"What information should I provide?",answer:"Include the caravan or motorhome make and model, registration if available, your location, a description of the problem and clear photographs where useful."},
 {question:"Does Brandon RV have a workshop or store vehicles?",answer:"The proposed business operates as a mobile service. It does not operate a workshop or store customer vehicles."},
 {question:"Can I request insurance work?",answer:"Selected insurance-related jobs may be considered later after insurer authority, payment terms, access, capability and insurance cover are confirmed. Brandon RV does not claim authorised repairer status."},
 {question:"How are prices and parts handled?",answer:"The work is assessed individually. You receive the proposed scope and costs before approving work. Job-specific parts are generally arranged after the quote and any agreed parts payment are approved."}
];
export default async function FAQPage(){
 const page=await getPublishedSitePage("faq");
 if(page?.content?.builder)return <main><PublicSiteBuilder data={page.content.builder}/></main>;const published=Array.isArray(page?.content.items)?page.content.items.filter((x):x is {question:string;answer:string}=>!!x&&typeof x==="object"&&typeof (x as any).question==="string"&&typeof (x as any).answer==="string"):[];const items=published.length?published:fallback;
 return <main><section className="page-hero"><div className="shell"><p className="eyebrow"><span className="eyebrow-line"/> GOOD TO KNOW</p><h1>Frequently asked <em>questions.</em></h1><p>{contentText(page?.content,"intro","A few details about mobile service, enquiries and what to expect.")}</p></div></section><section className="content-section"><div className="shell"><div className="detail-list">{items.map((item,i)=><article className="detail-item" key={i}><span>{String(i+1).padStart(2,"0")}</span><h2>{item.question}</h2><p>{item.answer}</p></article>)}</div></div></section></main>;
}