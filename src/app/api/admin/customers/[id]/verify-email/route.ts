import {currentUser,currentMembership,database,userHasPermission,jsonError,sameOrigin} from "@/lib/auth";
export const runtime="nodejs";
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
 if(!sameOrigin(request))return jsonError("Invalid request origin.",403);
 const user=await currentUser();
 if(!user)return jsonError("Not signed in.",401);
 const membership=await currentMembership(user.id);
 if(!membership||!(await userHasPermission(user.id,"customers.manage")))return jsonError("You do not have permission to verify customer accounts.",403);
 const {id}=await params;
 if(!/^[0-9a-f-]{36}$/i.test(id))return jsonError("Customer not found.",404);
 const db=database(),businessId=membership.business_id;
 const {data:account,error:accountError}=await db.from("users").select("id,email,primary_group,status").eq("id",id).eq("business_id",businessId).eq("primary_group","customer").eq("status","unverified").maybeSingle();
 if(accountError||!account)return jsonError("Unverified account not found.",404);
 const verifiedAt=new Date().toISOString();
 const {data:updated,error}=await db.from("users").update({email_verified_at:verifiedAt,status:"active",primary_group:"customer",updated_at:verifiedAt}).eq("id",id).eq("primary_group","customer").eq("status","unverified").select("id").maybeSingle();
 if(error)return jsonError("Could not verify the customer email.",500);
 if(!updated)return jsonError("This account has already been verified or is unavailable.",409);
 const {error:auditError}=await db.from("audit_events").insert({business_id:businessId,actor_user_id:user.id,action:"customer.email_manually_verified",entity_type:"user",entity_id:id,details:{email:account.email,verified_at:verifiedAt,verification_method:"manual",previous_status:account.status,new_status:"active"}});
 if(auditError)return jsonError("Customer was verified, but the audit record could not be saved.",500);
 return Response.json({success:true,emailVerifiedAt:verifiedAt});
}
