import {authorizePermission,database,digest,jsonError,sameOrigin} from "@/lib/auth";
export const runtime="nodejs";
export async function POST(request:Request){
 if(!sameOrigin(request))return jsonError("Invalid request origin.",403);
 const access=await authorizePermission("customers.view");if(access.response)return access.response;
 try{
  const body=await request.json(),token=String(body.token??"").trim();if(token.length<32||token.length>200)return jsonError("Invalid invitation link.");
  const db=database(),now=new Date().toISOString();
  const {data:invite,error}=await db.from("staff_invitations").select("id,business_id,email,user_id,role_key,job_title,employment_type,start_date,expires_at,accepted_at,revoked_at").eq("token_hash",digest(token)).maybeSingle();
  if(error||!invite||invite.accepted_at||invite.revoked_at||invite.expires_at<=now)return jsonError("This invitation is invalid, expired or already used.",410);
  const user=access.user!;
  if(user.email.toLowerCase()!==invite.email.toLowerCase())return jsonError("Sign in using the customer account invited at "+invite.email+".",403);
  if(user.business_id!==invite.business_id||user.primary_group!=="customer"||user.status!=="active")return jsonError("The signed-in account is not eligible for this invitation.",403);
  if(invite.user_id&&invite.user_id!==user.id)return jsonError("This invitation belongs to a different account.",403);
  if(user.user_role&&user.employment_status==="active")return jsonError("This account already has active staff access.",409);
  const {data:updated,error:updateError}=await db.from("users").update({user_role:invite.role_key,employment_status:"active",employment_type:invite.employment_type,job_title:invite.job_title,start_date:invite.start_date,updated_at:now}).eq("id",user.id).eq("business_id",invite.business_id).eq("primary_group","customer").eq("status","active").select("id").maybeSingle();
  if(updateError||!updated)return jsonError("Could not activate staff access.",500);
  const {data:accepted,error:acceptError}=await db.from("staff_invitations").update({user_id:user.id,accepted_at:now}).eq("id",invite.id).is("accepted_at",null).is("revoked_at",null).select("id").maybeSingle();
  if(acceptError||!accepted){await db.from("users").update({user_role:null,employment_status:null,employment_type:null,job_title:null,start_date:null}).eq("id",user.id);return jsonError("This invitation was already accepted or revoked.",409);}
  const tasks=["Review workplace policies","Provide emergency contact details","Complete payroll and superannuation setup","Review safety and workshop procedures"];
  await db.from("hr_onboarding_tasks").insert(tasks.map((title,index)=>({business_id:invite.business_id,user_id:user.id,title,sort_order:index})));
  await db.from("audit_events").insert({business_id:invite.business_id,actor_user_id:user.id,action:"staff.invitation.accepted",entity_type:"user",entity_id:user.id,details:{invitation_id:invite.id,role_key:invite.role_key}});
  return Response.json({success:true,role:invite.role_key});
 }catch{return jsonError("Could not accept the staff invitation.",500);}
}
