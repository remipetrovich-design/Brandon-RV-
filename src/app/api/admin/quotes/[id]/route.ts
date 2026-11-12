import {authorizePermission,database,jsonError,sameOrigin} from "@/lib/auth";
export const runtime="nodejs";

export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}){
 if(!sameOrigin(request))return jsonError("Invalid request origin.",403);
 const access=await authorizePermission("quotes.approve");
 if(access.response)return access.response;
 const {id}=await params;
 if(!/^[0-9a-f-]{36}$/i.test(id))return jsonError("Invalid quote ID.");
 const {data,error}=await database().rpc("issue_quote_for_jobcard",{
  p_quote_id:id,
  p_business_id:access.membership!.business_id,
  p_actor_user_id:access.user!.id
 });
 if(error){
  if(error.code==="P0001")return jsonError(error.message??"This quote cannot be issued yet.",409);
  return jsonError("Could not issue quote. No changes were made.",500);
 }
 await database().from("audit_events").insert({
  business_id:access.membership!.business_id,
  actor_user_id:access.user!.id,
  action:"quote.issue_requested",
  entity_type:"quote",
  entity_id:id,
  details:{result:data}
 });
 return Response.json(data);
}
