import {database,digest,jsonError,sameOrigin} from "@/lib/auth";
export const runtime="nodejs";
async function guestTicket(id:string,token:string){
 const db=database();const {data:enquiry}=await db.from("enquiries").select("id,business_id,contact_name,email,request_number,requested_service,description,vehicle_description,vehicle_id,location,preferred_contact,created_at,stage,status,guest_access_token_hash,guest_access_expires_at,request_type").eq("id",id).maybeSingle();
 if(!enquiry||enquiry.request_type!=="quote_request"||!token||enquiry.guest_access_token_hash!==digest(token)||!enquiry.guest_access_expires_at||Date.parse(enquiry.guest_access_expires_at)<=Date.now())return {db,enquiry:null};
 return {db,enquiry};
}
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
 const {id}=await params;const token=new URL(request.url).searchParams.get("guestToken")??"";const {db,enquiry}=await guestTicket(id,token);if(!enquiry)return jsonError("Request not found or guest access expired.",404);
 const {data:quotes,error}=await db.from("quotes").select("id,quote_number,status,revision_number,issue_date,expiry_date,subtotal,tax_amount,total,notes,terms,quote_items(id,description,quantity,unit_price,line_total)").eq("enquiry_id",id).order("revision_number",{ascending:false});
 if(error)return jsonError("Could not load your quotes.",500);
 const [{data:vehicle},{data:appointments}]=await Promise.all([
  enquiry.vehicle_id?db.from("vehicles").select("make,model,year,vehicle_type,registration").eq("id",enquiry.vehicle_id).maybeSingle():Promise.resolve({data:null}),
  db.from("appointments").select("id,quote_id,status,preferred_start,starts_at,location").eq("enquiry_id",enquiry.id).order("created_at",{ascending:false})
 ]);
 return Response.json({appointments:appointments??[],jobcard:{id:enquiry.id,request_number:enquiry.request_number,requested_service:enquiry.requested_service,description:enquiry.description,vehicle_description:enquiry.vehicle_description,location:enquiry.location,preferred_contact:enquiry.preferred_contact,created_at:enquiry.created_at,stage:enquiry.stage,status:enquiry.status},vehicle,quotes:quotes??[]});
}
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
 if(!sameOrigin(request))return jsonError("Invalid request origin.",403);
 const {id}=await params;
 try{
  const body=await request.json();
  const token=String(body.guestToken??"");
  const response=String(body.response??"");
  const quoteId=String(body.quoteId??"");
  const responseNote=String(body.responseNote??"").trim().slice(0,1000);
  if(!["accepted","declined"].includes(response)||!/^[0-9a-f-]{36}$/i.test(quoteId))return jsonError("Invalid quote response.");
  if(!token||token.length<20)return jsonError("Request not found or guest access expired.",404);
  const db=database();
  const {data:quote}=await db.from("quotes").select("quote_kind").eq("id",quoteId).eq("enquiry_id",id).maybeSingle();
  const rpcName=quote?.quote_kind==="variation"?"respond_to_guest_job_variation":"respond_to_guest_quote";
  const args=quote?.quote_kind==="variation"
   ?{p_ticket_id:id,p_quote_id:quoteId,p_guest_token_hash:digest(token),p_response,p_response_note:responseNote||null}
   :{p_ticket_id:id,p_quote_id:quoteId,p_guest_token_hash:digest(token),p_response,p_response_note:responseNote||null};
  const {data,error}=await db.rpc(rpcName,args);
  if(error){
   if(error.code==="P0001")return jsonError("This quote or guest access is no longer available.",409);
   return jsonError("Could not save your quote response. No changes were made.",500);
  }
  if(!data?.success)return jsonError("Could not confirm your quote response. No changes were made.",500);
  return Response.json({success:true,response,archived:data.request_archived===true});
 }catch{return jsonError("Could not save your quote response.",500);}
}
