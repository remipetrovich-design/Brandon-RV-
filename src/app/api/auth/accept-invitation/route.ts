import {createSession,database,digest,normalizeEmail,passwordHash,passwordMatches,jsonError,sameOrigin} from "@/lib/auth";
export const runtime="nodejs";
export async function POST(request:Request){
 if(!sameOrigin(request))return jsonError("Invalid request origin.",403);
 try{
  const body=await request.json();const token=String(body.token??"");const password=String(body.password??"");
  if(token.length<32||password.length<12||password.length>128)return jsonError("Invitation token or password is invalid.");
  const db=database();const {data:invite}=await db.from("user_invitations").select("*").eq("token_hash",digest(token)).is("accepted_at",null).gt("expires_at",new Date().toISOString()).maybeSingle();
  if(!invite)return jsonError("This invitation is invalid or has expired.",410);
  const isOwner=invite.account_type==="owner";
  const email=normalizeEmail(isOwner?String(body.email??""):String(invite.email??""));
  const requestedName=String(isOwner?body.fullName:invite.full_name??"").trim();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254||requestedName.length<2||requestedName.length>120)return jsonError("Enter a valid name and email address.");
  if(isOwner){const {count}=await db.from("business_members").select("id",{count:"exact",head:true}).eq("business_id",invite.business_id).eq("role","owner").eq("is_active",true);if((count??0)>0)return jsonError("The business owner account has already been created.",409);}
  const {data:existing}=await db.from("users").select("id,email,full_name,account_type,status,password_hash,primary_group,secondary_group").eq("email",email).maybeSingle();
  if(existing&&["suspended","disabled"].includes(existing.status))return jsonError("This existing account is not active. Contact Brandon RV before accepting the invitation.",403);
  if(existing?.password_hash&&!await passwordMatches(password,existing.password_hash))return jsonError("This email already has an account. Sign in with that account's existing password to accept the business invitation.",401);
  const {data:existingMembership}=existing?await db.from("business_members").select("id").eq("user_id",existing.id).eq("business_id",invite.business_id).eq("is_active",true).maybeSingle():{data:null};
  if(existingMembership)return jsonError("This account already has business access.",409);
  const now=new Date().toISOString();const {data:claimed}=await db.from("user_invitations").update({accepted_at:now}).eq("id",invite.id).is("accepted_at",null).select("id").maybeSingle();if(!claimed)return jsonError("This invitation has already been used.",410);
  let user:any=existing;let created=false;const role=isOwner?"owner":String(invite.role??"employee");
  if(user&&!user.password_hash){const {error}=await db.from("users").update({password_hash:await passwordHash(password),status:"active",email_verified_at:now,updated_at:now}).eq("id",user.id);if(error)return jsonError("Could not activate this account. Contact Brandon RV for help.",500);}
  else if(user&&user.status!=="active"){const {error}=await db.from("users").update({status:"active",email_verified_at:now,updated_at:now}).eq("id",user.id);if(error)return jsonError("Could not activate this account. Contact Brandon RV for help.",500);}
  if(user){const {error}=await db.from("users").update({primary_group:"customer",secondary_group:"staff",account_type:"customer",business_id:invite.business_id,updated_at:now}).eq("id",user.id);if(error)return jsonError("Could not add business access to this account.",500);}
  if(!user){
   const {data:newUser,error}=await db.from("users").insert({email,full_name:requestedName,password_hash:await passwordHash(password),account_type:"customer",status:"active",email_verified_at:now,primary_group:"customer",secondary_group:"staff",business_id:invite.business_id}).select("id,email,full_name,account_type,status").single();
   if(error||!newUser)return jsonError("Could not create the account. Contact Brandon RV for a new invitation.",500);
   user=newUser;created=true;
  }
  const {error:staffError}=await db.from("staff").insert({business_id:invite.business_id,user_id:user.id,job_title:invite.job_title??(role==="owner"?"Owner":role),employment_type:invite.employment_type??"full_time",employment_status:"active",start_date:now.slice(0,10)});
  const {error:memberError}=await db.from("business_members").insert({business_id:invite.business_id,user_id:user.id,role,is_active:true,invited_at:invite.created_at,joined_at:now});
  if(staffError||memberError){await db.from("staff").delete().eq("user_id",user.id);await db.from("business_members").delete().eq("user_id",user.id);if(created)await db.from("users").delete().eq("id",user.id);return jsonError("Could not finish setting up account access. Contact Brandon RV for a new invitation.",500);}
  await createSession(user.id,request);const {password_hash:_passwordHash,...safeUser}=user;return Response.json({user:{...safeUser,account_type:"customer",primary_group:"customer"}},{status:201});
 }catch{return jsonError("Could not accept invitation.");}
}
