import {currentUser,database,jsonError,sameOrigin} from "@/lib/auth";
export const runtime="nodejs";
type Params={params:Promise<{id:string}>};
export async function PATCH(request:Request,{params}:Params){
 if(!sameOrigin(request))return jsonError("Invalid request origin.",403);
 const user=await currentUser();if(!user)return jsonError("Not signed in.",401);if(user.account_type!=="customer")return jsonError("Customer account required.",403);
 const {id}=await params;if(!/^[0-9a-f-]{36}$/i.test(id))return jsonError("Vehicle not found.",404);
 try{
  const body=await request.json();const make=String(body.make??"").trim().slice(0,80)||null;const model=String(body.model??"").trim().slice(0,100)||null;const vehicle_type=String(body.vehicle_type??"").trim().slice(0,40)||null;const registration=String(body.registration??"").trim().toUpperCase().slice(0,20)||null;const vin=String(body.vin??"").trim().toUpperCase().slice(0,40)||null;const notes=String(body.notes??"").trim().slice(0,1000)||null;const year=body.year?Number(body.year):null;
  if(!make&&!model)return jsonError("Enter a vehicle make or model.");if(year!==null&&(!Number.isInteger(year)||year<1950||year>2100))return jsonError("Enter a valid vehicle year.");
  const db=database();const {data:customer}=await db.from("customers").select("business_id").eq("user_id",user.id).maybeSingle();if(!customer)return jsonError("Customer profile not found.",404);
  const {data:vehicle,error}=await db.from("vehicles").update({make,model,year,vehicle_type,registration,vin,notes,updated_at:new Date().toISOString()}).eq("id",id).eq("customer_id",user.id).select("id,make,model,year,vehicle_type,registration,vin,notes").maybeSingle();
  if(error)return jsonError("Could not update vehicle.",500);if(!vehicle)return jsonError("Vehicle not found.",404);
  return Response.json({vehicle});
 }catch{return jsonError("Invalid vehicle details.");}
}