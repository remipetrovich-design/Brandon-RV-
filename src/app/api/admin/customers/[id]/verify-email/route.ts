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
 const {data:customer,error:customerError}=await db.from("customers").select("id,user_id,email").eq("id",id).eq("business_id",businessId).maybeSingle();
 if(customerError||!customer)return jsonError("Customer not found.",404);
 const userId=customer.user_id??customer.id;
 const verifiedAt=new Date().toISOString();
 const {data:account,error}=await db.from("users").update({email_verified_at:verifiedAt,status:"active"}).eq("id",userId).eq("primary_group","customer").is("email_verified_at",null).select("id").maybeSingle();
 if(error)return jsonError("Could not verify the customer email.",500);
 if(!account)return jsonError("This customer is already verified or the account is unavailable.",409);
 const {error:auditError}=await db.from("audit_events").insert({business_id:businessId,actor_user_id:user.id,action:"customer.email_manually_verified",entity_type:"customer",entity_id:id,details:{email:customer.email,verified_at:verifiedAt}});
 if(auditError)return jsonError("Customer was verified, but the audit record could not be saved.",500);
 return Response.json({success:true,emailVerifiedAt:verifiedAt});
}
