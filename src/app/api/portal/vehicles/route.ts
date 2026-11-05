import { currentUser,database,jsonError } from "@/lib/auth";
export const runtime="nodejs";
export async function GET(){
 const user=await currentUser(); if(!user) return jsonError("Not signed in.",401);
 if(user.account_type!=="customer") return jsonError("Customer account required.",403);
 const db=database();
 const {data:customer,error}=await db.from("customers").select("id").eq("user_id",user.id).maybeSingle();
 if(error||!customer) return jsonError("Customer profile not found.",404);
 const {data:vehicles,error:vehicleError}=await db.from("vehicles").select("id,make,model,year,vehicle_type,registration,vin,notes,created_at").eq("customer_id",customer.id).order("created_at",{ascending:false});
 if(vehicleError) return jsonError("Could not load vehicles.",500);
 return Response.json({vehicles:vehicles??[]});
}
export async function POST(request:Request){
 const user=await currentUser(); if(!user) return jsonError("Not signed in.",401);
 if(user.account_type!=="customer") return jsonError("Customer account required.",403);
 try{
  const body=await request.json();
  const make=String(body.make??"").trim().slice(0,80)||null;
  const model=String(body.model??"").trim().slice(0,100)||null;
  const vehicle_type=String(body.vehicle_type??"").trim().slice(0,40)||null;
  const registration=String(body.registration??"").trim().toUpperCase().slice(0,20)||null;
  const vin=String(body.vin??"").trim().toUpperCase().slice(0,40)||null;
  const notes=String(body.notes??"").trim().slice(0,1000)||null;
  const year=body.year?Number(body.year):null;
  if(!make&&!model) return jsonError("Enter a vehicle make or model.");
  if(year!==null&&(!Number.isInteger(year)||year<1950||year>2100)) return jsonError("Enter a valid vehicle year.");
  const db=database();
  const {data:customer}=await db.from("customers").select("id,business_id").eq("user_id",user.id).maybeSingle();
  if(!customer) return jsonError("Customer profile not found.",404);
  const {data:vehicle,error}=await db.from("vehicles").insert({business_id:customer.business_id,customer_id:customer.id,make,model,year,vehicle_type,registration,vin,notes}).select("id,make,model,year,vehicle_type,registration,vin,notes").single();
  if(error||!vehicle) return jsonError("Could not save vehicle.",500);
  return Response.json({vehicle},{status:201});
 }catch{return jsonError("Invalid vehicle details.");}
}