import type {Metadata} from "next";
import Link from "next/link";
import GeneralEnquiryForm from "@/components/general-enquiry-form";
import PublicSiteBuilder from "@/components/public-site-builder";
import {currentUser} from "@/lib/auth";
import {getPublicBusiness,getPublicBusinessSettings,phoneHref,getPublishedSitePage,getPublishedServices,getPublishedServiceAreas,contentText} from "@/lib/public-site";
export const metadata:Metadata={title:"General Enquiry",description:"General enquiries for Brandon RV in Tamworth, NSW."};
export default async function GeneralEnquiryPage(){
 const [business,page,settings,user,services,areas]=await Promise.all([getPublicBusiness(),getPublishedSitePage("contact"),getPublicBusinessSettings(),currentUser(),getPublishedServices(),getPublishedServiceAreas()]);
 if(page?.content?.builder)return <main><PublicSiteBuilder data={page.content.builder} services={services} areas={areas}/></main>;
 const phone=business.phone??"0407 189 087";const callLink=phoneHref(phone);
 const location=[business.city,business.region].filter(Boolean).join(" ")||"Tamworth NSW";
 const intro=contentText(page?.content,"intro","For general enquiries, contact Brandon RV with a question about the mobile service, service suitability or how the process works.");
 return <main><section className="page-hero"><div className="shell"><p className="eyebrow"><span className="eyebrow-line"/> GENERAL ENQUIRY</p><h1>Ask Brandon <em>RV.</em></h1><p>{intro}</p></div></section>
  <section className="content-section"><div className="shell contact-grid"><div className="contact-guidance"><h2>General questions</h2><p>Use this page for general information about Brandon RV, the mobile service, service suitability or how the process works.</p><p>For a specific repair or accessory job, use Request a Quote. That creates a Jobcard for assessment and keeps the quote, booking and work history together.</p>{settings.customer_message&&<p>{settings.customer_message}</p>}{settings.accepting_enquiries?<Link href="/request-quote" className="button button-primary">Request a quote <span>→</span></Link>:<p>Online quote requests are currently paused. Please call Brandon RV for general information.</p>}</div>
   <GeneralEnquiryForm initialName={user?.full_name??""} initialEmail={user?.email??""} initialPhone={user?.phone??""} isLoggedIn={user?.account_type==="customer"}/>
   <div className="contact-card"><span>CALL BRANDON RV</span><strong><a href={callLink}>{phone}</a></strong><p>Mobile service based in {location}. Contact us to discuss general questions or your location.</p><span>SERVICE AREA</span><strong>Tamworth & surrounds</strong><p>Travel outside the usual local area can be discussed when you enquire.</p>{settings.operating_hours&&<><span>OPERATING HOURS</span><p>{settings.operating_hours}</p></>}</div>
  </div></section></main>;
}
