import "server-only";
import {unstable_cache} from "next/cache";
import {database} from "@/lib/auth";
export type PublicSitePage={title:string;meta_title:string|null;meta_description:string|null;content:Record<string,unknown>};
export type PublicService={id:string;name:string;slug:string;category:string|null;description:string|null;scope_notes:string|null;price_from:number|null;pricing_label:string|null;sort_order:number};
type PublicBusinessRecord={id:string;name:string;brand_line:string|null;phone:string|null;city:string|null;region:string|null;status:string|null};
const readPublicBusinessRecord=unstable_cache(async():Promise<PublicBusinessRecord|null>=>{
 try{const {data}=await database().from("businesses").select("id,name,brand_line,phone,city,region,status").eq("slug","brandon-rv").maybeSingle();return data??null;}catch{return null;}
},["brv-public-business-record-v1"],{revalidate:60,tags:["brv-public-site"]});
const readPublishedSitePage=unstable_cache(async(slug:string):Promise<PublicSitePage|null>=>{
 try{const business=await readPublicBusinessRecord();if(!business)return null;const {data}=await database().from("site_pages").select("title,meta_title,meta_description,content").eq("business_id",business.id).eq("slug",slug).eq("is_published",true).maybeSingle();if(!data)return null;const content=data.content&&typeof data.content==="object"&&!Array.isArray(data.content)?data.content as Record<string,unknown>:{};return {...data,content};}catch{return null;}
},["brv-published-site-page-v1"],{revalidate:60,tags:["brv-public-site"]});
export async function getPublishedSitePage(slug:string){return readPublishedSitePage(slug);}
const readPublishedServices=unstable_cache(async():Promise<PublicService[]>=>{
 try{const business=await readPublicBusinessRecord();if(!business)return [];const {data}=await database().from("services").select("id,name,slug,category,description,scope_notes,price_from,pricing_label,sort_order").eq("business_id",business.id).eq("is_active",true).eq("is_published",true).eq("approval_status","approved_for_launch").order("sort_order").order("name");return data??[];}catch{return [];}
},["brv-published-services-v1"],{revalidate:60,tags:["brv-public-site"]});
export async function getPublishedServices(){return readPublishedServices();}
const readPublishedServiceAreas=unstable_cache(async()=>{
 try{const business=await readPublicBusinessRecord();if(!business)return [];const {data}=await database().from("service_areas").select("id,name,description,radius_km,travel_fee,suburbs,postcodes,sort_order").eq("business_id",business.id).eq("is_published",true).order("sort_order");return data??[];}catch{return [];}
},["brv-published-service-areas-v1"],{revalidate:60,tags:["brv-public-site"]});
export async function getPublishedServiceAreas(){return readPublishedServiceAreas();}
export function contentText(content:Record<string,unknown>|undefined,key:string,fallback:string){const value=content?.[key];return typeof value==="string"&&value.trim()?value.trim():fallback;}
export type PublicBusiness={name:string;brand_line:string|null;phone:string|null;city:string|null;region:string|null;status:string|null};
const readPublicBusiness=unstable_cache(async():Promise<PublicBusiness>=>{
 const fallback:PublicBusiness={name:"Brandon RV",brand_line:"From Factory Experience to Repairs On The Go",phone:null,city:"Tamworth",region:"NSW",status:"prelaunch"};
 const data=await readPublicBusinessRecord();return data?{...fallback,...data}:fallback;
},["brv-public-business-v1"],{revalidate:60,tags:["brv-public-site"]});
export async function getPublicBusiness(){return readPublicBusiness();}
export type PublicBusinessSettings={accepting_enquiries:boolean;booking_notice_hours:number;operating_hours:string;customer_message:string};
const readPublicBusinessSettings=unstable_cache(async():Promise<PublicBusinessSettings>=>{
 const fallback:PublicBusinessSettings={accepting_enquiries:true,booking_notice_hours:24,operating_hours:"",customer_message:""};
 try{const business=await readPublicBusinessRecord();if(!business)return fallback;const {data}=await database().from("business_settings").select("settings").eq("business_id",business.id).maybeSingle();const settings=data?.settings&&typeof data.settings==="object"&&!Array.isArray(data.settings)?data.settings as Record<string,unknown>:{};return {...fallback,accepting_enquiries:settings.accepting_enquiries!==false,booking_notice_hours:Number(settings.booking_notice_hours??24),operating_hours:String(settings.operating_hours??""),customer_message:String(settings.customer_message??"")};}catch{return fallback;}
},["brv-public-business-settings-v1"],{revalidate:60,tags:["brv-public-site"]});
export async function getPublicBusinessSettings(){return readPublicBusinessSettings();}
export function phoneHref(value:string|null|undefined){const digits=String(value??"").replace(/[^0-9+]/g,"");if(!digits)return "";if(digits.startsWith("0"))return "tel:+61"+digits.slice(1);return "tel:"+digits;}
