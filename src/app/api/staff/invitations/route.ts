import {randomBytes} from "node:crypto";
import {authorizePermission,database,digest,jsonError,normalizeEmail,sameOrigin} from "@/lib/auth";
import {isGlobalAdministrator} from "@/lib/user-role-policy.mjs";
import {sendEmail} from "@/lib/email";
export const runtime="nodejs";
const validEmail=(v:string)=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
export async function GET(){
 const access=await authorizePermission("staff.view");if(access.response)return access.response;
 const {data,error}=await database().from("staff_invitations").select("id,email,user_id,role_key,job_title,employment_type,start_date,expires_at,created_at").eq("business_id",access.membership!.business_id).is("accepted_at",null).is("revoked_at",null).gt("expires_at",new Date().toISOString()).order("created_at",{ascending:false});
 if(error)return jsonError("Could not load staff invitations.",500);
 return Response.json({invitations:data??[]});
}
export async function POST(request:Request){
 if(!sameOrigin(request))return jsonError("Invalid request origin.",403);
 const access=await authorizePermission("staff.manage");if(access.response)return access.response;
 try{
  const body=await request.json(),email=normalizeEmail(String(body.email??"")),roleKey=String(body.roleKey??"").trim();
  const jobTitle=String(body.jobTitle??"").trim(),employmentType=String(body.employmentType??"full_time"),startDate=body.startDate?String(body.startDate):new Date().toISOString().slice(0,10);
  if(!validEmail(email)||email.length>254)return jsonError("Enter a valid email address.");
  if(!jobTitle||jobTitle.length>100)return jsonError("Enter a job title.");
  if(!["casual","part_time","full_time"].includes(employmentType))return jsonError("Select a valid employment type.");
  if(!/^\d{4}-\d{2}-\d{2}$/.test(startDate)||Number.isNaN(Date.parse(startDate)))return jsonError("Enter a valid start date.");
  const db=database(),businessId=access.membership!.business_id;
  const {data:role}=await db.from("user_roles").select("role_key,name").eq("role_key",roleKey).maybeSingle();
  if(!role||roleKey==="customer")return jsonError("Select a valid staff role.");
  if(["owner","website_developer"].includes(roleKey)&&!isGlobalAdministrator(access.user?.user_role))return jsonError("Only a global administrator can invite this role.",403);
  const {data:user}=await db.from("users").select("id,user_role,employment_status,status,primary_group").eq("email",email).eq("business_id",businessId).maybeSingle();
  if(user&&(user.primary_group!=="customer"||user.status!=="active"))return jsonError("This account is not an active customer account.",409);
  if(user?.user_role&&user.employment_status==="active")return jsonError("This customer already has active staff access.",409);
  await db.from("staff_invitations").update({revoked_at:new Date().toISOString()}).eq("business_id",businessId).eq("email",email).is("accepted_at",null).is("revoked_at",null);
  const token=randomBytes(32).toString("base64url"),expiresAt=new Date(Date.now()+7*86400000).toISOString();
  const {data:invitation,error}=await db.from("staff_invitations").insert({business_id:businessId,email,user_id:user?.id??null,role_key:roleKey,job_title:jobTitle,employment_type:employmentType,start_date:startDate,invited_by:access.user!.id,token_hash:digest(token),expires_at:expiresAt}).select("id").single();
  if(error||!invitation)return jsonError("Could not create the staff invitation.",500);
  const origin=process.env.NEXT_PUBLIC_APP_URL??new URL(request.url).origin;
  const link=origin+"/portal/accept-staff-invitation?token="+encodeURIComponent(token);
  const sent=await sendEmail({to:email,subject:"You're invited to join Brandon RV",html:`<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#172b3d"><h2>Staff invitation</h2><p>You have been invited to join Brandon RV as <strong>${role.name}</strong>.</p><p>Position: ${jobTitle}</p><p>Sign in to your existing customer account, or create a customer account with this email address, then accept the invitation.</p><p><a href="${link}" style="display:inline-block;padding:12px 20px;background:#1762a8;color:#fff;text-decoration:none;border-radius:4px">Accept invitation</a></p><p>This invitation expires in seven days. Your customer account and history remain unchanged.</p></div>`});
  await db.from("audit_events").insert({business_id:businessId,actor_user_id:access.user!.id,action:"staff.invitation.created",entity_type:"staff_invitation",entity_id:invitation.id,details:{email,role_key:roleKey,email_sent:sent}});
  return Response.json({success:true,emailSent:sent},{status:201});
 }catch{return jsonError("Could not create the staff invitation.",500);}
}
export async function DELETE(request:Request){
 if(!sameOrigin(request))return jsonError("Invalid request origin.",403);
 const access=await authorizePermission("staff.manage");if(access.response)return access.response;
 try{const {id}=await request.json();const {data,error}=await database().from("staff_invitations").update({revoked_at:new Date().toISOString()}).eq("id",String(id)).eq("business_id",access.membership!.business_id).is("accepted_at",null).is("revoked_at",null).select("id").maybeSingle();if(error||!data)return jsonError("Invitation not found or already used.",404);return Response.json({success:true});}catch{return jsonError("Could not revoke invitation.",500);}
}
