import {currentUser,database,jsonError,sameOrigin} from "@/lib/auth";
export const runtime="nodejs";
export async function GET(){
 const user=await currentUser();if(!user)return jsonError("Not signed in.",401);
 if(user.primary_group!=="customer")return jsonError("Customer account required.",403);
 const db=database();const {data:profile,error}=await db.from("users").select("full_name,email,phone,address,suburb,state,postcode").eq("id",user.id).eq("primary_group","customer").maybeSingle();
 if(error||!profile)return jsonError("Customer profile not found.",404);
 return Response.json({profile});
}
export async function PATCH(request:Request){
 if(!sameOrigin(request))return jsonError("Invalid request origin.",403);
 const user=await currentUser();if(!user)return jsonError("Not signed in.",401);
 if(user.primary_group!=="customer")return jsonError("Customer account required.",403);
 try{
  const body=await request.json();const fullName=String(body.full_name??"").trim();const phone=String(body.phone??"").trim();
  if(fullName.length<2||fullName.length>120||phone.length>40)return jsonError("Enter a valid name and phone number.");
  const values={full_name:fullName,phone:phone||null,address:String(body.address??"").trim().slice(0,200)||null,suburb:String(body.suburb??"").trim().slice(0,100)||null,state:String(body.state??"").trim().slice(0,20)||null,postcode:String(body.postcode??"").trim().slice(0,12)||null,updated_at:new Date().toISOString()};
  const db=database();const {data:updated,error}=await db.from("users").update(values).eq("id",user.id).eq("primary_group","customer").select("id").maybeSingle();
  if(error||!updated)return jsonError("Could not save profile changes.",500);
  return Response.json({success:true});
 }catch{return jsonError("Invalid profile details.");}
}
