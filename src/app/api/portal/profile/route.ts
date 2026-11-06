import {currentUser,database,jsonError,sameOrigin} from "@/lib/auth";
export const runtime="nodejs";
export async function GET(){
 const user=await currentUser();if(!user)return jsonError("Not signed in.",401);
 const db=database();const {data:customer}=await db.from("customers").select("full_name,first_name,last_name,date_of_birth,email,phone,address,suburb,state,postcode").eq("user_id",user.id).maybeSingle();
 if(!customer)return jsonError("Customer profile not found.",404);
 return Response.json({profile:{...customer,email:user.email,full_name:user.full_name,first_name:user.first_name??customer.first_name,last_name:user.last_name??customer.last_name,date_of_birth:user.date_of_birth??customer.date_of_birth,phone:user.phone??customer.phone}});
}
export async function PATCH(request:Request){
 if(!sameOrigin(request))return jsonError("Invalid request origin.",403);
 const user=await currentUser();if(!user)return jsonError("Not signed in.",401);
 try{
  const body=await request.json();const fullName=String(body.full_name??"").trim();const phone=String(body.phone??"").trim();
  const dateOfBirth=body.date_of_birth===undefined?undefined:String(body.date_of_birth??"").trim();
  if(fullName.length<2||fullName.length>120||phone.length>40)return jsonError("Enter a valid name and phone number.");
  if(dateOfBirth&&dateOfBirth!==""&&(!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)||Number.isNaN(Date.parse(dateOfBirth))||new Date(dateOfBirth)>new Date()))return jsonError("Enter a valid date of birth.");
  const parts=fullName.split(/\s+/);const firstName=parts[0]??"";const lastName=parts.slice(1).join(" ")||null;
  const values={address:String(body.address??"").trim().slice(0,200)||null,suburb:String(body.suburb??"").trim().slice(0,100)||null,state:String(body.state??"").trim().slice(0,20)||null,postcode:String(body.postcode??"").trim().slice(0,12)||null};
  const db=database();const {data:customer}=await db.from("customers").select("id").eq("user_id",user.id).maybeSingle();if(!customer)return jsonError("Customer profile not found.",404);
  const now=new Date().toISOString();const userUpdate:any={full_name:fullName,first_name:firstName,last_name:lastName,phone:phone||null,updated_at:now};
  if(dateOfBirth!==undefined)userUpdate.date_of_birth=dateOfBirth||null;
  const {error}=await db.from("users").update(userUpdate).eq("id",user.id);
  if(error)return jsonError("Could not save profile changes.",500);
  const {error:customerError}=await db.from("customers").update({full_name:fullName,phone:phone||null,...values,updated_at:now}).eq("id",customer.id);
  if(customerError)return jsonError("Could not save profile changes.",500);
  return Response.json({success:true});
 }catch{return jsonError("Invalid profile details.");}
}
