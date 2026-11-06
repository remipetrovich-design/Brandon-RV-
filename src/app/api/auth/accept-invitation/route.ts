import {createSession,database,digest,normalizeEmail,passwordHash,jsonError,sameOrigin} from "@/lib/auth";
export const runtime="nodejs";
export async function POST(request:Request){
 if(!sameOrigin(request))return jsonError("Invalid request origin.",403);
 try{
  const body=await request.json();const token=String(body.token??"");const email=normalizeEmail(String(body.email??""));const fullName=String(body.fullName??"").trim();const password=String(body.password??"");
  if(token.length<32||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254||fullName.length<2||fullName.length>120||password.length<12||password.length>128)return jsonError("Enter a valid name, email and password.");
  const db=database();const {data:invite}=await db.from("user_invitations").select("*").eq("token_hash",digest(token)).is("accepted_at",null).gt("expires_at",new Date().toISOString()).maybeSingle();
  if(!invite)return jsonError("This setup link is invalid or has expired.",410);
  if(invite.account_type!=="owner")return jsonError("Staff invitations are no longer supported. Select an existing customer account and add employee details from People management.",410);
  const {count}=await db.from("users").select("id",{count:"exact",head:true}).eq("user_role","owner");if((count??0)>0)return jsonError("The business owner account has already been created.",409);
  const {data:existing}=await db.from("users").select("id").eq("email",email).maybeSingle();if(existing)return jsonError("An account with this email already exists. Sign in to that customer account and assign owner access from the employee directory.",409);
  const parts=fullName.split(/\s+/);const now=new Date().toISOString();
  const {data:user,error}=await db.from("users").insert({email,full_name:fullName,first_name:parts[0]??fullName,last_name:parts.slice(1).join(" ")||null,password_hash:await passwordHash(password),account_type:"customer",status:"active",email_verified_at:now,primary_group:"customer",business_id:invite.business_id,user_role:"owner",employee_number:"OWNER",job_title:"Owner",employment_status:"active",employment_type:"full_time",start_date:now.slice(0,10)}).select("id,email,full_name,account_type").single();
  if(error||!user)return jsonError("Could not create the owner account.",500);
  const {data:claimed}=await db.from("user_invitations").update({accepted_at:now}).eq("id",invite.id).is("accepted_at",null).select("id").maybeSingle();
  if(!claimed){await db.from("users").delete().eq("id",user.id);return jsonError("This setup link has already been used.",410);}
  await createSession(user.id,request);return Response.json({user:{...user,account_type:"customer"}},{status:201});
 }catch{return jsonError("Owner setup is temporarily unavailable.",500);}
}
