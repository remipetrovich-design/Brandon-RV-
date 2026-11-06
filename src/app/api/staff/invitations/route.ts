import {authorizePermission,database,digest,newToken,jsonError,sameOrigin} from "@/lib/auth";
import {sendEmail} from "@/lib/email";
export const runtime="nodejs";
export async function POST(request:Request){
 if(!sameOrigin(request))return jsonError("Invalid request origin.",403);const access=await authorizePermission("staff.manage");if(access.response)return access.response;
 try{
  const body=await request.json();const email=String(body.email??"").trim().toLowerCase();const fullName=String(body.fullName??"").trim();const requestedRole=String(body.role??"").trim();const jobTitle=String(body.jobTitle??"").trim();const employmentType=String(body.employmentType??"full_time");
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||fullName.length<2||fullName.length>120)return jsonError("Enter a valid name and email address.");
  const db=database();const {data:roleGroup}=await db.from("permission_groups").select("name").eq("business_id",access.membership!.business_id).ilike("name",requestedRole).maybeSingle();if(!roleGroup||roleGroup.name.toLowerCase()==="owner")return jsonError("Select a configured staff role.");if(roleGroup.name.toLowerCase()==="developer"&&!["owner","developer"].includes(access.membership!.role.toLowerCase()))return jsonError("Only the owner or an existing developer can invite a developer.",403);
  const {data:existing}=await db.from("users").select("id,primary_group,secondary_group").eq("email",email).maybeSingle();
  if(existing&&[existing.primary_group,existing.secondary_group].includes("staff"))return jsonError("This account already has staff access.",409);
  const token=newToken();const {error}=await db.from("user_invitations").insert({business_id:access.membership!.business_id,email,full_name:fullName,account_type:"staff",role:roleGroup.name,job_title:jobTitle,employment_type:employmentType,token_hash:digest(token),invited_by:access.user!.id,expires_at:new Date(Date.now()+7*86400000).toISOString()});if(error)return jsonError("Could not create staff invitation.",500);
  const base=process.env.NEXT_PUBLIC_APP_URL??new URL(request.url).origin;const invitationUrl=base+"/staff/accept-invitation?token="+encodeURIComponent(token);const safeName=fullName.replace(/[&<>"]/g,"");
  const emailSent=await sendEmail({to:email,subject:"Your Brandon RV staff invitation",html:"<p>Hi "+safeName+",</p><p>You have been invited to join Brandon RV as "+roleGroup.name+".</p><p><a href=\""+invitationUrl+"\">Accept staff invitation</a></p><p>This invitation expires in seven days.</p>"});
  return Response.json({success:true,invitationUrl,emailSent,expiresInDays:7},{status:201});
 }catch{return jsonError("Could not create staff invitation.",500);}
}
