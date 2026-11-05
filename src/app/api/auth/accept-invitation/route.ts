import {createSession,database,digest,normalizeEmail,passwordHash,jsonError,sameOrigin} from "@/lib/auth";
export const runtime="nodejs";
export async function POST(request:Request){
 if(!sameOrigin(request))return jsonError("Invalid request origin.",403);
 try{
  const body=await request.json();const token=String(body.token??"");const password=String(body.password??"");
  if(token.length<32||password.length<12||password.length>128)return jsonError("Invitation token or password is invalid.");
  const db=database();const {data:invite}=await db.from("user_invitations").select("*").eq("token_hash",digest(token)).is("accepted_at",null).gt("expires_at",new Date().toISOString()).maybeSingle();
  if(!invite)return jsonError("This invitation is invalid or has expired.",410);
  const isOwner=invite.account_type==="owner";const email=normalizeEmail(isOwner?String(body.email??""):String(invite.email??""));const requestedName=String(isOwner?body.fullName:invite.full_name??"").trim();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254||requestedName.length<2||requestedName.length>120)return jsonError("Enter a valid name and email address.");
  if(isOwner){const {count}=await db.from("users").select("id",{count:"exact",head:true}).eq("account_type","owner");if((count??0)>0)return jsonError("The business owner account has already been created.",409);}
  const {data:existing}=await db.from("users").select("id,email,full_name,account_type,status,primary_group,secondary_group").eq("email",email).maybeSingle();
  if(existing&&isOwner)return jsonError("An account with this email already exists.",409);
  if(existing&&existing.status!=="active")return jsonError("This existing account is not active. Contact Brandon RV before accepting the invitation.",403);
  if(existing&&[existing.primary_group,existing.secondary_group].includes("staff"))return jsonError("This account already has staff access.",409);
  const now=new Date().toISOString();const {data:claimed}=await db.from("user_invitations").update({accepted_at:now}).eq("id",invite.id).is("accepted_at",null).select("id").maybeSingle();if(!claimed)return jsonError("This invitation has already been used.",410);
  let user:any=existing;let created=false;
  if(!user){
   const {data:newUser,error}=await db.from("users").insert({email,full_name:requestedName,password_hash:await passwordHash(password),account_type:isOwner?"owner":"staff",status:"active",email_verified_at:null,primary_group:"staff",secondary_group:null,business_id:invite.business_id}).select("id,email,full_name,account_type,status").single();
   if(error||!newUser)return jsonError("Could not create the account. The invitation has been consumed; contact Brandon RV for a new setup link.",500);
   user=newUser;created=true;
  }
  const {error:staffError}=await db.from("staff").insert({business_id:invite.business_id,user_id:user.id,job_title:isOwner?"Owner":invite.role,employment_status:"active",start_date:now.slice(0,10),employee_number:isOwner?"OWNER":null});
  const {error:memberError}=await db.from("business_members").insert({business_id:invite.business_id,user_id:user.id,role:isOwner?"owner":invite.role,is_active:true,invited_at:invite.created_at,joined_at:now});
  if(staffError||memberError){await db.from("staff").delete().eq("user_id",user.id);await db.from("business_members").delete().eq("user_id",user.id);if(created)await db.from("users").delete().eq("id",user.id);return jsonError("Could not finish setting up account access. Contact Brandon RV for a new invitation.",500);}
  await createSession(user.id,request);const {password_hash:_passwordHash,...safeUser}=user;return Response.json({user:safeUser},{status:201});
 }catch{return jsonError("Could not accept invitation.");}
}
