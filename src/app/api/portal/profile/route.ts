import {currentUser,database,jsonError,sameOrigin} from "@/lib/auth";
export const runtime="nodejs";
const isValidBirthDate=(value:string)=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;const date=new Date(value+"T00:00:00Z");return !Number.isNaN(date.getTime())&&date.toISOString().slice(0,10)===value&&date<=new Date();};
export async function GET(){
 const user=await currentUser();if(!user)return jsonError("Not signed in.",401);
 const db=database();const {data:customer}=await db.from("users").select("full_name,first_name,last_name,date_of_birth,email,phone,address,suburb,state,postcode").eq("id",user.id).eq("primary_group","customer").maybeSingle();
 if(!customer)return jsonError("Customer profile not found.",404);
 return Response.json({profile:{...customer,email:user.email,full_name:user.full_name,first_name:user.first_name??customer.first_name,last_name:user.last_name??customer.last_name,date_of_birth:user.date_of_birth??customer.date_of_birth,phone:user.phone??customer.phone}});
}
export async function PATCH(request:Request){
 if(!sameOrigin(request))return jsonError("Invalid request origin.",403);
 const user=await currentUser();if(!user)return jsonError("Not signed in.",401);
 try{
  const body=await request.json();const suppliedFirst=body.first_name===undefined?undefined:String(body.first_name??"").trim();const suppliedLast=body.last_name===undefined?undefined:String(body.last_name??"").trim();const legacyFullName=String(body.full_name??"").trim();const legacyParts=legacyFullName.split(/\\s+/);const firstName=suppliedFirst??legacyParts[0]??"";const lastName=suppliedLast??legacyParts.slice(1).join(" ");const fullName=[firstName,lastName].filter(Boolean).join(" ");const phone=String(body.phone??"").trim();
  const dateOfBirth=body.date_of_birth===undefined?undefined:String(body.date_of_birth??"").trim();
  if(!firstName||!lastName||firstName.length>120||lastName.length>120||fullName.length>120||phone.length>40)return jsonError("Enter a valid first name, last name and phone number.");
  if(dateOfBirth&&dateOfBirth!==""&&!isValidBirthDate(dateOfBirth))return jsonError("Enter a valid date of birth.");
  const parts=fullName.split(/\s+/);const firstName=parts[0]??"";const lastName=parts.slice(1).join(" ")||null;
  const values={address:String(body.address??"").trim(),suburb:String(body.suburb??"").trim(),state:String(body.state??"").trim(),postcode:String(body.postcode??"").trim()};if(values.address.length>500||values.suburb.length>120||values.state.length>80||values.postcode.length>12)return jsonError("One or more address fields exceed the allowed length.");
  const db=database();
  const now=new Date().toISOString();const userUpdate:any={full_name:fullName,first_name:firstName,last_name:lastName,phone:phone||null,address:values.address||null,suburb:values.suburb||null,state:values.state||null,postcode:values.postcode||null,updated_at:now};
  if(dateOfBirth!==undefined)userUpdate.date_of_birth=dateOfBirth||null;
  const {data:updated,error}=await db.from("users").update(userUpdate).eq("id",user.id).eq("primary_group","customer").select("id").maybeSingle();
  if(error||!updated)return jsonError("Could not save profile changes.",500);
  return Response.json({success:true});
 }catch{return jsonError("Invalid profile details.");}
}
