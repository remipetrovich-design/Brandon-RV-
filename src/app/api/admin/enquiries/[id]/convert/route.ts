import {currentUser,currentMembership,database,userHasPermission,jsonError,sameOrigin} from "@/lib/auth";
export const runtime="nodejs";
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
 if(!sameOrigin(request))return jsonError("Invalid request origin.",403);const user=await currentUser();if(!user)return jsonError("Not signed in.",401);const membership=await currentMembership(user.id);if(!membership)return jsonError("Business access required.",403);
 const [canManageCustomers,canManageEnquiries]=await Promise.all([userHasPermission(user.id,"customers.manage"),userHasPermission(user.id,"enquiries.manage")]);if(!canManageCustomers||!canManageEnquiries)return jsonError("You do not have permission to convert enquiries.",403);
 try{
  const {id}=await params;const db=database();const {data:enquiry}=await db.from("enquiries").select("id,customer_id,user_id,contact_name,email,phone,description,location,requested_service,status").eq("id",id).eq("business_id",membership.business_id).maybeSingle();if(!enquiry)return jsonError("Enquiry not found.",404);
  if(enquiry.customer_id)return Response.json({success:true,customerId:enquiry.customer_id,alreadyLinked:true});
  let customer:any=null;
  if(enquiry.user_id){const result=await db.from("customers").select("id").eq("business_id",membership.business_id).eq("user_id",enquiry.user_id).maybeSingle();customer=result.data;}
  if(!customer){const result=await db.from("customers").select("id,user_id").eq("business_id",membership.business_id).ilike("email",enquiry.email).maybeSingle();customer=result.data;if(customer&&!customer.user_id&&enquiry.user_id)await db.from("customers").update({user_id:enquiry.user_id}).eq("id",customer.id);}
  if(!customer){const {data:created,error}=await db.from("customers").insert({business_id:membership.business_id,user_id:enquiry.user_id,full_name:enquiry.contact_name,email:enquiry.email,phone:enquiry.phone,status:"active",internal_notes:"Created from enquiry "+id+". "+String(enquiry.description??"").slice(0,1500)}).select("id").single();if(error||!created)return jsonError("Could not create customer record.",500);customer=created;}
  const {error:updateError}=await db.from("enquiries").update({customer_id:customer.id,status:enquiry.status==="new"?"reviewing":enquiry.status,updated_at:new Date().toISOString()}).eq("id",id);
  if(updateError)return jsonError("Customer was created but enquiry could not be linked. Contact support.",500);
  await db.from("audit_events").insert({business_id:membership.business_id,actor_user_id:user.id,action:"enquiry.converted_to_customer",entity_type:"enquiry",entity_id:id,details:{customer_id:customer.id}});
  return Response.json({success:true,customerId:customer.id});
 }catch{return jsonError("Could not convert enquiry.",500);}
}