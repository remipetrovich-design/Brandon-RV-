import {randomBytes} from "node:crypto";
import {authorizePermission,database,digest,jsonError,normalizeEmail,sameOrigin} from "@/lib/auth";
import {isGlobalAdministrator} from "@/lib/user-role-policy.mjs";
import {sendBrandonRvTemplateEmail} from "@/lib/email";
export const runtime="nodejs";
const validEmail=(v:string)=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const staffRoleKeys=["apprentice","senior_worker","office","supervisor","manager","owner","website_developer"];
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
  if(!role||!staffRoleKeys.includes(roleKey))return jsonError("Select one of the available Brandon RV staff titles.");
  if(["owner","website_developer"].includes(roleKey)&&!isGlobalAdministrator(access.user?.user_role))return jsonError("Only a global administrator can invite this role.",403);
  const {data:user}=await db.from("users").select("id,user_role,employment_status,status,primary_group").eq("email",email).eq("business_id",businessId).maybeSingle();
  if(user&&(user.primary_group!=="customer"||user.status!=="active"))return jsonError("This account is not an active customer account.",409);
  if(user?.user_role&&user.employment_status!=="terminated")return jsonError("This customer already has staff access or an existing staff restriction.",409);
  await db.from("staff_invitations").update({revoked_at:new Date().toISOString()}).eq("business_id",businessId).eq("email",email).is("accepted_at",null).is("revoked_at",null);
  const token=randomBytes(32).toString("base64url"),expiresAt=new Date(Date.now()+7*86400000).toISOString();
  const {data:invitation,error}=await db.from("staff_invitations").insert({business_id:businessId,email,user_id:user?.id??null,role_key:roleKey,job_title:jobTitle,employment_type:employmentType,start_date:startDate,invited_by:access.user!.id,token_hash:digest(token),expires_at:expiresAt}).select("id").single();
  if(error||!invitation)return jsonError("Could not create the staff invitation.",500);
  const origin=process.env.NEXT_PUBLIC_APP_URL??new URL(request.url).origin;
  const link=origin+"/portal/accept-staff-invitation?token="+encodeURIComponent(token);
  const sent=await sendBrandonRvTemplateEmail({templateId:"staff_invitation",sender:"brandonrv",to:email,variables:{firstname:email.split("@")[0],email,inviter_name:access.user?.full_name??"Brandon RV",staff_role:role.name,job_title:jobTitle,invitation_url:link,expiry_time:"7 days"}});
  await db.from("audit_events").insert({business_id:businessId,actor_user_id:access.user!.id,action:"staff.invitation.created",entity_type:"staff_invitation",entity_id:invitation.id,details:{email,role_key:roleKey,email_sent:sent}});
  return Response.json({success:true,emailSent:sent,inviteUrl:sent?null:link},{status:201});
 }catch{return jsonError("Could not create the staff invitation.",500);}
}
export async function DELETE(request:Request){
 if(!sameOrigin(request))return jsonError("Invalid request origin.",403);
 const access=await authorizePermission("staff.manage");if(access.response)return access.response;
 try{const {id}=await request.json();const {data,error}=await database().from("staff_invitations").update({revoked_at:new Date().toISOString()}).eq("id",String(id)).eq("business_id",access.membership!.business_id).is("accepted_at",null).is("revoked_at",null).select("id").maybeSingle();if(error||!data)return jsonError("Invitation not found or already used.",404);return Response.json({success:true});}catch{return jsonError("Could not revoke invitation.",500);}
}