import Link from "next/link";
import EnquiryForm from "@/components/enquiry-form";
import WebsiteGeneralEnquiryBlock from "@/components/website-general-enquiry-block";

type BuilderService={id:string;name:string;description:string|null;price_from:number|null;pricing_label:string|null};
type BuilderArea={id:string;name:string;description:string|null;suburbs:string[]|null;postcodes:string[]|null;travel_fee:number|null;radius_km:number|null};

export function createWebsiteBuilderConfig(data:{services?:BuilderService[];areas?:BuilderArea[];isEditing?:boolean}={}){
 const services=data.services??[];
 const areas=data.areas??[];
 const isEditing=data.isEditing===true;
 return {
  categories:{
   content:{title:"Page content",components:["Hero","Heading","TextBlock","ImageBlock","Spacer","FAQList","GalleryGrid","ProcessSteps"]},
   brandon:{title:"Protected Brandon RV components",components:["RequestQuoteCTA","RequestQuoteForm","GeneralEnquiryForm","ServicesFeed","ServiceAreasFeed"]}
  },
  components:{
   Hero:{
    fields:{title:{type:"text"},subtitle:{type:"textarea"},imageUrl:{type:"text"},imageAlt:{type:"text"}},
    defaultProps:{title:"Your headline",subtitle:"Introduce the page and explain what Brandon RV offers.",imageUrl:"",imageAlt:""},
    render:({title,subtitle,imageUrl,imageAlt}:any)=><section className="page-hero"><div className="shell"><p className="eyebrow"><span className="eyebrow-line"/> BRANDON RV</p><h1>{title}</h1><p>{subtitle}</p>{imageUrl&&<img src={imageUrl} alt={imageAlt||""} style={{maxWidth:"100%",height:"auto"}}/>}</div></section>
   },
   Heading:{
    fields:{text:{type:"text"},level:{type:"select",options:[{label:"Heading 2",value:"h2"},{label:"Heading 3",value:"h3"}]}},
    defaultProps:{text:"Section heading",level:"h2"},
    render:({text,level}:any)=>level==="h3"?<h3>{text}</h3>:<h2>{text}</h2>
   },
   TextBlock:{
    fields:{heading:{type:"text"},text:{type:"textarea"}},
    defaultProps:{heading:"",text:"Add your page copy here."},
    render:({heading,text}:any)=><section className="content-section"><div className="shell">{heading&&<h2>{heading}</h2>}<p style={{whiteSpace:"pre-line"}}>{text}</p></div></section>
   },
   ImageBlock:{
    fields:{src:{type:"text"},alt:{type:"text"},caption:{type:"text"}},
    defaultProps:{src:"",alt:"",caption:""},
    render:({src,alt,caption}:any)=><figure className="shell" style={{padding:"32px 0"}}>{src&&<img src={src} alt={alt||""} style={{display:"block",width:"100%",height:"auto",borderRadius:12}}/>}{caption&&<figcaption>{caption}</figcaption>}</figure>
   },
   Spacer:{
    fields:{height:{type:"number",min:8,max:160}},
    defaultProps:{height:32},
    render:({height}:any)=><div aria-hidden="true" style={{height:Math.min(160,Math.max(8,Number(height)||32))}}/>
   },
   FAQList:{
    fields:{heading:{type:"text"},items:{type:"array",arrayFields:{question:{type:"text"},answer:{type:"textarea"}},defaultItemProps:{question:"New question",answer:"Answer"}}},
    defaultProps:{heading:"Frequently asked questions",items:[]},
    render:({heading,items}:any)=><section className="content-section"><div className="shell"><h2>{heading}</h2><div className="detail-list">{(items??[]).map((item:any,index:number)=><article className="detail-item" key={index}><h3>{item.question}</h3><p>{item.answer}</p></article>)}</div></div></section>
   },
   GalleryGrid:{
    fields:{heading:{type:"text"},items:{type:"array",arrayFields:{title:{type:"text"},description:{type:"textarea"},url:{type:"text"},alt:{type:"text"}},defaultItemProps:{title:"Work photo",description:"",url:"",alt:""}}},
    defaultProps:{heading:"Previous work",items:[]},
    render:({heading,items}:any)=><section className="content-section"><div className="shell"><h2>{heading}</h2>{items?.length?<div className="service-grid">{items.map((item:any,index:number)=><article className="service-card" key={index}>{item.url&&<img src={item.url} alt={item.alt||item.title||""} loading="lazy"/>}<h3>{item.title}</h3>{item.description&&<p>{item.description}</p>}</article>)}</div>:<p>Work photographs will appear here when they are ready to publish.</p>}</div></section>
   },
   ProcessSteps:{
    fields:{heading:{type:"text"},steps:{type:"array",arrayFields:{text:{type:"textarea"}},defaultItemProps:{text:"Describe this step."}}},
    defaultProps:{heading:"How it works",steps:[]},
    render:({heading,steps}:any)=><section className="content-section"><div className="shell"><h2>{heading}</h2><div className="detail-list">{(steps??[]).map((step:any,index:number)=><article className="detail-item" key={index}><span>{String(index+1).padStart(2,"0")}</span><p>{step.text}</p></article>)}</div></div></section>
   },
   RequestQuoteCTA:{
    fields:{heading:{type:"text"},text:{type:"textarea"},label:{type:"text"}},
    defaultProps:{heading:"Need a hand with your RV?",text:"Send through the vehicle details and what needs attention. Brandon RV will review the request and come back to you.",label:"Request a quote"},
    render:({heading,text,label}:any)=><section className="home-final-cta"><div className="shell home-final-cta-inner"><div><h2>{heading}</h2><p>{text}</p></div><div className="home-final-cta-actions"><Link className="button button-primary" href="/request-quote">{label} <span aria-hidden="true">→</span></Link></div></div></section>
   },
   RequestQuoteForm:{
    fields:{},
    defaultProps:{},
    render:()=> <section className="content-section"><div className="shell"><EnquiryForm preview={isEditing}/></div></section>
   },
   GeneralEnquiryForm:{
    fields:{},
    defaultProps:{},
    render:()=> <section className="content-section"><div className="shell"><WebsiteGeneralEnquiryBlock preview={isEditing}/></div></section>
   },
   ServicesFeed:{
    fields:{heading:{type:"text"},intro:{type:"textarea"}},
    defaultProps:{heading:"Our services",intro:"Services currently approved and published by Brandon RV."},
    render:({heading,intro}:any)=><section className="content-section brv-combined-services"><div className="shell"><h2>{heading}</h2><p>{intro}</p>{services.length?<div className="detail-list">{services.map(service=><article className="detail-item" key={service.id}><h3>{service.name}</h3><p>{service.description??"Contact Brandon RV to discuss this service."}</p>{service.pricing_label&&<strong>{service.pricing_label}</strong>}{service.price_from!==null&&<strong>From ${Number(service.price_from).toFixed(2)} AUD</strong>}</article>)}</div>:<p>Service details are being updated. Contact Brandon RV to discuss your requirements.</p>}</div></section>
   },
   ServiceAreasFeed:{
    fields:{heading:{type:"text"},intro:{type:"textarea"}},
    defaultProps:{heading:"Where we work",intro:"Brandon RV is based in the Tamworth region. Share your location and we will confirm whether travel is practical."},
    render:({heading,intro}:any)=><section className="content-section"><div className="shell"><h2>{heading}</h2><p>{intro}</p>{areas.length?<div className="detail-list">{areas.map(area=><article className="detail-item" key={area.id}><h3>{area.name}</h3>{area.description&&<p>{area.description}</p>}<p>{[...(area.suburbs??[]),...(area.postcodes??[])].join(" · ")}</p>{area.radius_km!==null&&<small>Radius: {area.radius_km} km</small>}{area.travel_fee!==null&&<small>Travel fee: ${Number(area.travel_fee).toFixed(2)}</small>}</article>)}</div>:<p>Contact Brandon RV to check your location.</p>}</div></section>
   }
  }
 };
}

export function defaultWebsiteBuilderData(pageId:string,title:string,legacy:Record<string,unknown>){
 const heroTitle=typeof legacy.hero_title==="string"?legacy.hero_title:title;
 const subtitle=typeof legacy.hero_subtitle==="string"?legacy.hero_subtitle:typeof legacy.intro==="string"?legacy.intro:"";
 const intro=typeof legacy.intro==="string"?legacy.intro:"";
 const hero={type:"Hero",props:{id:pageId+"-hero",title:heroTitle,subtitle,imageUrl:"",imageAlt:""}};
 if(pageId==="request-quote"){
  return {root:{props:{title}},content:[hero,{type:"TextBlock",props:{id:pageId+"-intro",heading:"",text:intro||"Share your vehicle details and what needs attention. We will review the request before discussing a quote or visit."}},{type:"RequestQuoteForm",props:{id:pageId+"-form"}}]};
 }
 if(pageId==="contact"){
  return {root:{props:{title}},content:[hero,{type:"TextBlock",props:{id:pageId+"-intro",heading:"",text:intro||"For general enquiries, contact Brandon RV with a question about the mobile service, service suitability or how the process works."}},{type:"GeneralEnquiryForm",props:{id:pageId+"-form"}}]};
 }
 if(pageId==="how-it-works"){
  const steps=Array.isArray(legacy.steps)?legacy.steps.filter((step:unknown):step is string=>typeof step==="string"):[ ];
  return {root:{props:{title}},content:[hero,{type:"TextBlock",props:{id:pageId+"-intro",heading:"",text:intro}},{type:"ProcessSteps",props:{id:pageId+"-steps",heading:"From enquiry to handover",steps:steps.map(text=>({text}))}},{type:"ServiceAreasFeed",props:{id:pageId+"-areas",heading:"Where we work",intro:"Published service areas and travel information."}},{type:"RequestQuoteCTA",props:{id:pageId+"-quote"}}]};
 }
 if(pageId==="faq"){
  const items=Array.isArray(legacy.items)?legacy.items.filter((item:any)=>item&&typeof item.question==="string"&&typeof item.answer==="string").map((item:any)=>({question:item.question,answer:item.answer})):[];
  return {root:{props:{title}},content:[hero,{type:"FAQList",props:{id:pageId+"-faq",heading:"Frequently asked questions",items}},{type:"RequestQuoteCTA",props:{id:pageId+"-quote",heading:"Have a question about a job?",text:"Send through the vehicle details and what needs attention.",label:"Request a quote"}}]};
 }
 if(pageId==="gallery"){
  const items=Array.isArray(legacy.photos)?legacy.photos.filter((item:any)=>item&&typeof item.title==="string"&&typeof item.url==="string").map((item:any)=>({title:item.title,description:String(item.description??""),url:item.url,alt:item.title})):[];
  return {root:{props:{title}},content:[hero,{type:"GalleryGrid",props:{id:pageId+"-gallery",heading:"Previous work",items}}]};
 }
 return {
  root:{props:{title}},
  content:[
   hero,
   ...(intro?[{type:"TextBlock",props:{id:pageId+"-intro",heading:"",text:intro}}]:[]),
   {type:"ServicesFeed",props:{id:pageId+"-services",heading:"Our services",intro:"Services currently approved and published by Brandon RV."}},
   {type:"ServiceAreasFeed",props:{id:pageId+"-areas",heading:"Service areas",intro:"Share your location and Brandon RV will confirm whether travel is practical."}},
   {type:"RequestQuoteCTA",props:{id:pageId+"-quote",heading:"Have a job in mind?",text:"Send through the vehicle details and what needs attention.",label:typeof legacy.primary_action==="string"?legacy.primary_action:"Request a quote"}}
  ]
 };
}
