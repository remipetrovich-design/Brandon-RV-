import {currentUser,currentMembership,database,userHasPermission,jsonError,sameOrigin,digest} from "@/lib/auth";
export const runtime="nodejs";
async function accessFor(request:Request,id:string){
 const db=database();const {data:enquiry,error}=await db.from("enquiries").select("id,business_id,user_id,customer_id,contact_name,email,request_type,guest_access_token_hash,guest_access_expires_at").eq("id",id).maybeSingle();
 if(error||!enquiry||!["public_enquiry","general_enquiry","customer_enquiry","quote_request"].includes(enquiry.request_type))return {db,enquiry:null,mode:null as string|null,user:null};
 const user=await currentUser();
 const staffRequested=new URL(request.url).searchParams.get("view")==="staff";
 if(user&&staffRequested){const membership=await currentMembership(user.id);if(membership?.business_id===enquiry.business_id&&(await userHasPermission(user.id,"enquiries.view")))return {db,enquiry,mode:"staff",user};}
 if(user&&enquiry.user_id===user.id)return {db,enquiry,mode:"customer",user};
 if(user){const membership=await currentMembership(user.id);if(membership?.business_id===enquiry.business_id&&(await userHasPermission(user.id,"enquiries.view")))return {db,enquiry,mode:"staff",user};}
 const token=new URL(request.url).searchParams.get("guestToken")??request.headers.get("x-guest-access-token")??"";
 if(!enquiry.user_id&&token&&enquiry.guest_access_token_hash===digest(token)&&enquiry.guest_access_expires_at&&Date.parse(enquiry.guest_access_expires_at)>Date.now())return {db,enquiry,mode:"guest",user:null};
 return {db,enquiry:null,mode:null,user};
}
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
 const {id}=await params;const access=await accessFor(request,id);if(!access.enquiry||!access.mode)return jsonError("Ticket not found or access expired.",404);
 let query=access.db.from("customer_messages").select("id,sender_type,sender_user_id,guest_name,message,is_internal,created_at").eq("enquiry_id",id).order("created_at",{ascending:true});
 if(access.mode!=="staff")query=query.eq("is_internal",false);
 const {data,error}=await query;if(error)return jsonError("Could not load ticket messages.",500);
 return Response.json({messages:data??[],mode:access.mode});
}
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
 if(!sameOrigin(request))return jsonError("Invalid request origin.",403);
 const {id}=await params;const access=await accessFor(request,id);if(!access.enquiry||!access.mode)return jsonError("Ticket not found or access expired.",404);
 if(access.mode==="staff"&&(!access.user||!(await userHasPermission(access.user.id,"enquiries.manage"))))return jsonError("You do not have permission to reply to this ticket.",403);
 try{
  const body=await request.json();const message=String(body.message??"").trim();const isInternal=access.mode==="staff"&&body.isInternal===true;
  if(message.length<1||message.length>5000)return jsonError("Enter a message up to 5,000 characters.");
  const enquiry=access.enquiry;const user=access.user;
  const {data:record,error}=await access.db.from("customer_messages").insert({business_id:enquiry.business_id,customer_id:enquiry.user_id??null,user_id:enquiry.user_id??null,enquiry_id:enquiry.id,sender_type:access.mode==="staff"?"staff":"customer",sender_user_id:user?.id??null,guest_name:access.mode==="guest"?enquiry.contact_name:null,guest_email:access.mode==="guest"?enquiry.email:null,message,is_internal:isInternal}).select("id,sender_type,sender_user_id,guest_name,message,is_internal,created_at").single();
  if(error||!record)return jsonError("Could not send your message.",500);
  await access.db.from("audit_events").insert({business_id:enquiry.business_id,actor_user_id:user?.id??null,action:isInternal?"ticket.internal_note_added":"ticket.message_sent",entity_type:"enquiry",entity_id:enquiry.id,details:{message_id:record.id}});
  return Response.json({message:record},{status:201});
 }catch{return jsonError("Could not send your message.",500);}
}