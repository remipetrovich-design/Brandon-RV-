import {database,jsonError} from "@/lib/auth";
export const dynamic="force-dynamic";
export async function GET(){
 try{
  const db=database();
  const {data:business,error:businessError}=await db.from("businesses").select("id").eq("slug","brandon-rv").single();
  if(businessError||!business)return jsonError("Service areas are unavailable.",503);
  const {data,error}=await db.from("service_areas").select("id,name,description,radius_km,travel_fee,suburbs,postcodes").eq("business_id",business.id).eq("is_published",true).order("sort_order");
  if(error)return jsonError("Could not load published service areas.",500);
  return Response.json({areas:data??[]},{headers:{"Cache-Control":"no-store"}});
 }catch{return jsonError("Could not load published service areas.",500);}
}
