import {database,jsonError} from "@/lib/auth";
export const dynamic="force-dynamic";
export async function GET(){
 try{
  const db=database();
  const {data:business,error:businessError}=await db.from("businesses").select("id").eq("slug","brandon-rv").single();
  if(businessError||!business)return jsonError("Service catalogue is unavailable.",503);
  const {data,error}=await db.from("services").select("id,name,category,description,price_from,pricing_label").eq("business_id",business.id).eq("is_active",true).eq("is_published",true).eq("approval_status","approved_for_launch").order("sort_order").order("name");
  if(error)return jsonError("Could not load approved services.",500);
  return Response.json({services:data??[]},{headers:{"Cache-Control":"no-store"}});
 }catch{return jsonError("Could not load approved services.",500);}
}
