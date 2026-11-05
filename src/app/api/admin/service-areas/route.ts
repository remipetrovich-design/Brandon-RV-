import {authorizePermission,database,jsonError,sameOrigin} from "@/lib/auth";
export const runtime="nodejs";
const clean=(v:unknown,max:number)=>String(v??"").trim().slice(0,max);
export async function GET(){
 const access=await authorizePermission("business.settings.manage");if(access.response)return access.response;
 const {data,error}=await database().from("service_areas").select("id,name,description,radius_km,travel_fee,is_published,sort_order").eq("business_id",access.membership!.business_id).order("sort_order");
 if(error)return jsonError("Could not load service areas.",500);return Response.json({areas:data??[]});
}
export async function POST(request:Request){
 if(!sameOrigin(request))return jsonError("Invalid request origin.",403);const access=await authorizePermission("business.settings.manage");if(access.response)return access.response;
 try{const body=await request.json();const name=clean(body.name,120);const description=clean(body.description,1000);const radius=body.radius_km===""||body.radius_km===null?null:Number(body.radius_km);const fee=body.travel_fee===""||body.travel_fee===null?null:Number(body.travel_fee);if(name.length<2||radius!==null&&(!Number.isFinite(radius)||radius<0||radius>1000)||fee!==null&&(!Number.isFinite(fee)||fee<0||fee>100000))return jsonError("Enter a valid service area and travel setting.");
 const {data,error}=await database().from("service_areas").insert({business_id:access.membership!.business_id,name,description:description||null,radius_km:radius,travel_fee:fee,is_published:false,sort_order:100}).select("id,name,description,radius_km,travel_fee,is_published,sort_order").single();if(error||!data)return jsonError("Could not create service area.",500);return Response.json({area:data},{status:201});
 }catch{return jsonError("Could not create service area.");}
}
export async function PATCH(request:Request){
 if(!sameOrigin(request))return jsonError("Invalid request origin.",403);const access=await authorizePermission("business.settings.manage");if(access.response)return access.response;
 try{const body=await request.json();const id=String(body.id??"");if(!/^[0-9a-f-]{36}$/i.test(id))return jsonError("Invalid service area.");const update:Record<string,unknown>={};
 if(body.name!==undefined){const name=clean(body.name,120);if(name.length<2)return jsonError("Enter a valid area name.");update.name=name;}
 if(body.description!==undefined)update.description=clean(body.description,1000)||null;
 if(body.radius_km!==undefined){const n=body.radius_km===""||body.radius_km===null?null:Number(body.radius_km);if(n!==null&&(!Number.isFinite(n)||n<0||n>1000))return jsonError("Enter a valid service radius.");update.radius_km=n;}
 if(body.travel_fee!==undefined){const n=body.travel_fee===""||body.travel_fee===null?null:Number(body.travel_fee);if(n!==null&&(!Number.isFinite(n)||n<0||n>100000))return jsonError("Enter a valid travel fee.");update.travel_fee=n;}
 if(body.is_published!==undefined){if(typeof body.is_published!=="boolean")return jsonError("Invalid publication setting.");update.is_published=body.is_published;}
 if(body.sort_order!==undefined){const n=Number(body.sort_order);if(!Number.isInteger(n)||n<0||n>10000)return jsonError("Invalid display order.");update.sort_order=n;}
 const {data,error}=await database().from("service_areas").update(update).eq("id",id).eq("business_id",access.membership!.business_id).select("id,name,description,radius_km,travel_fee,is_published,sort_order").maybeSingle();if(error||!data)return jsonError("Could not update service area.",500);return Response.json({area:data});
 }catch{return jsonError("Could not update service area.");}
}