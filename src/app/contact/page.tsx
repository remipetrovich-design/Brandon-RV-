import type {Metadata} from "next";
import Link from "next/link";
import GeneralEnquiryForm from "@/components/general-enquiry-form";
import {getPublicBusiness,getPublicBusinessSettings,phoneHref,getPublishedSitePage,contentText} from "@/lib/public-site";
export const metadata:Metadata={title:"Contact & General Enquiries",description:"General enquiries for Brandon RV in Tamworth, NSW."};
export default async function ContactPage(){
 const [business,page,settings]=await Promise.all([getPublicBusiness(),getPublishedSitePage("contact"),getPublicBusinessSettings()]);
 const phone=business.phone??"0407 189 087";const callLink=phoneHref(phone);
 const location=[business.city,business.region].filter(Boolean).join(" ")||"Tamworth NSW";
 const intro=contentText(page?.content,"intro","For general enquiries, contact Brandon RV with a few details about your caravan or motorhome. We will discuss your requirements and the next step.");
 return <main><section className="page-hero"><div className="shell"><p className="eyebrow"><span className="eyebrow-line"/> GENERAL ENQUIRIES</p><h1>Contact <em>Brandon RV.</em></h1><p>{intro}</p></div></section>
  <section className="content-section"><div className="shell contact-grid"><div className="contact-guidance"><h2>General questions or something else?</h2><p>Use this contact page for general questions about Brandon RV, the mobile service, service suitability or how the process works.</p><p>For a specific repair or accessory job, include your vehicle details, location, a description and photos where possible.</p>{settings.customer_message&&<p>{settings.customer_message}</p>}{settings.accepting_enquiries?<Link href="/request-quote" className="button button-primary">Request a quote <span>→</span></Link>:<p>Online enquiries are currently paused. Please call Chris for general information.</p>}</div>
   <GeneralEnquiryForm/>
   <div className="contact-card"><span>CALL CHRIS</span><strong><a href={callLink}>{phone}</a></strong><p>Mobile service based in {location}. Contact us to discuss general questions or your location.</p><span>SERVICE AREA</span><strong>Tamworth & surrounds</strong><p>Travel outside the usual local area can be discussed when you enquire.</p>{settings.operating_hours&&<><span>OPERATING HOURS</span><p>{settings.operating_hours}</p></>}</div>
  </div></section></main>;
}
