import "server-only";
import {database} from "@/lib/auth";
export type PublicSitePage={title:string;meta_title:string|null;meta_description:string|null;content:Record<string,unknown>};
export type PublicService={id:string;name:string;slug:string;category:string|null;description:string|null;scope_notes:string|null;sort_order:number};
export async function getPublishedSitePage(slug:string):Promise<PublicSitePage|null>{
 try{
  const db=database();const {data:business}=await db.from("businesses").select("id").eq("slug","brandon-rv").maybeSingle();if(!business)return null;
  const {data}=await db.from("site_pages").select("title,meta_title,meta_description,content").eq("business_id",business.id).eq("slug",slug).eq("is_published",true).maybeSingle();
  if(!data)return null;const content=data.content&&typeof data.content==="object"&&!Array.isArray(data.content)?data.content as Record<string,unknown>:{};
  return {...data,content};
 }catch{return null;}
}
export async function getPublishedServices():Promise<PublicService[]>{
 try{
  const db=database();const {data:business}=await db.from("businesses").select("id").eq("slug","brandon-rv").maybeSingle();if(!business)return [];
  const {data}=await db.from("services").select("id,name,slug,category,description,scope_notes,sort_order").eq("business_id",business.id).eq("is_active",true).eq("is_published",true).order("sort_order").order("name");
  return data??[];
 }catch{return [];}
}
export async function getPublishedServiceAreas(){
 try{
  const db=database();const {data:business}=await db.from("businesses").select("id").eq("slug","brandon-rv").maybeSingle();if(!business)return [];
  const {data}=await db.from("service_areas").select("id,name,description,radius_km,travel_fee,sort_order").eq("business_id",business.id).eq("is_published",true).order("sort_order");
  return data??[];
 }catch{return [];}
}
export function contentText(content:Record<string,unknown>|undefined,key:string,fallback:string){
 const value=content?.[key];return typeof value==="string"&&value.trim()?value.trim():fallback;
}
