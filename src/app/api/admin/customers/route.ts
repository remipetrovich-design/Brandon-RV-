import {authorizePermission,database,jsonError,normalizeEmail,sameOrigin} from "@/lib/auth";
export const runtime="nodejs";
export async function POST(request:Request){
 if(!sameOrigin(request))return jsonError("Invalid request origin.",403);
 const access=await authorizePermission("customers.manage");if(access.response)return access.response;
 try{
  const body=await request.json();
  const firstName=String(body.firstName??"").trim(),lastName=String(body.lastName??"").trim();
  const email=normalizeEmail(String(body.email??""));
  const phone=String(body.phone??"").trim(),address=String(body.address??"").trim(),suburb=String(body.suburb??"").trim(),state=String(body.state??"").trim(),postcode=String(body.postcode??"").trim();
  if(!firstName||!lastName||firstName.length>120||lastName.length>120)return jsonError("Enter the customer's first and last name.");
  if(!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)||email.length>254)return jsonError("Enter a valid email address.");
  if(phone.length>40||address.length>500||suburb.length>120||state.length>80||postcode.length>12)return jsonError("One or more contact details exceed the allowed length.");
  const db=database(),businessId=access.membership!.business_id;
  const {data:existing}=await db.from("users").select("id").eq("email",email).maybeSingle();
  if(existing)return jsonError("An account with that email address already exists.",409);
  const fullName=firstName+" "+lastName;
  const {data:user,error}=await db.from("users").insert({email,password_hash:null,full_name:fullName,first_name:firstName,last_name:lastName,phone:phone||null,address:address||null,suburb:suburb||null,state:state||null,postcode:postcode||null,account_type:"customer",primary_group:"customer",user_role:null,business_id:businessId,status:"active",email_verified_at:null}).select("id").single();
  if(error||!user)return jsonError("Could not create the customer account.",500);
  const {data:customer,error:customerError}=await db.from("customers").insert({business_id:businessId,user_id:user.id,full_name:fullName,email,phone:phone||null,address:address||null,suburb:suburb||null,state:state||null,postcode:postcode||null,status:"active"}).select("id").single();
  if(customerError||!customer){await db.from("users").delete().eq("id",user.id);return jsonError("Could not create the customer profile.",500);}
  await db.from("audit_events").insert({business_id:businessId,actor_user_id:access.user!.id,action:"customer.created",entity_type:"customer",entity_id:customer.id,details:{email}});
  return Response.json({success:true,id:customer.id},{status:201});
 }catch{return jsonError("Could not create the customer.",500);}
}
