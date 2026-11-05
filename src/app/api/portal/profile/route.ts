import {currentUser,database,jsonError,sameOrigin} from "@/lib/auth";
export const runtime="nodejs";
export async function GET(){
 const user=await currentUser();if(!user)return jsonError("Not signed in.",401);
 if(user.account_type!=="customer")return jsonError("Customer account required.",403);
 const db=database();const {data:customer}=await db.from("customers").select("full_name,email,phone,address,suburb,state,postcode").eq("user_id",user.id).maybeSingle();
 if(!customer)return jsonError("Customer profile not found.",404);
 return Response.json({profile:{...customer,email:user.email,full_name:user.full_name,phone:user.phone??customer.phone}});
}
export async function PATCH(request:Request){
 if(!sameOrigin(request))return jsonError("Invalid request origin.",403);
 const user=await currentUser();if(!user)return jsonError("Not signed in.",401);
 if(user.account_type!=="customer")return jsonError("Customer account required.",403);
 try{
  const body=await request.json();const fullName=String(body.full_name??"").trim();const phone=String(body.phone??"").trim();
  if(fullName.length<2||fullName.length>120||phone.length>40)return jsonError("Enter a valid name and phone number.");
  const values={address:String(body.address??"").trim().slice(0,200)||null,suburb:String(body.suburb??"").trim().slice(0,100)||null,state:String(body.state??"").trim().slice(0,20)||null,postcode:String(body.postcode??"").trim().slice(0,12)||null};
  const db=database();const {data:customer}=await db.from("customers").select("id").eq("user_id",user.id).maybeSingle();if(!customer)return jsonError("Customer profile not found.",404);
  const now=new Date().toISOString();const [u,c]=await Promise.all([
   db.from("users").update({full_name:fullName,phone:phone||null,updated_at:now}).eq("id",user.id),
   db.from("customers").update({full_name:fullName,phone:phone||null,...values,updated_at:now}).eq("id",customer.id)
  ]);
  if(u.error||c.error)return jsonError("Could not save profile changes.",500);
  return Response.json({success:true});
 }catch{return jsonError("Invalid profile details.");}
}