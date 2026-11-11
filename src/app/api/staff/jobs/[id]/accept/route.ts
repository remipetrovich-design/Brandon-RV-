import {currentUser,currentMembership,database,jsonError,sameOrigin} from "@/lib/auth";
export const runtime="nodejs";
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
 if(!sameOrigin(request))return jsonError("Invalid request origin.",403);
 const user=await currentUser();if(!user)return jsonError("Not signed in.",401);
 const membership=await currentMembership(user.id);if(!membership)return jsonError("Staff access required.",403);
 const {id}=await params;const db=database();
 const {data:staff}=await db.from("staff").select("id").eq("user_id",user.id).eq("business_id",membership.business_id).maybeSingle();
 if(!staff)return jsonError("Employee profile not found.",404);
 const {data:job}=await db.from("jobs").select("id,status,workcard_review_status").eq("id",id).eq("business_id",membership.business_id).maybeSingle();
 if(!job)return jsonError("Workcard not found.",404);
 if(!["approved","legacy_approved"].includes(String(job.workcard_review_status??"legacy_approved")))return jsonError("This Workcard is not ready to be accepted. Senior setup review is still required.",409);
 const {data:assignment}=await db.from("job_assignments").select("id,status").eq("job_id",id).eq("staff_id",staff.id).maybeSingle();
 if(!assignment||assignment.status==="removed")return jsonError("This Work Order has not been assigned to you.",403);
 if(assignment.status==="accepted")return Response.json({success:true,alreadyAccepted:true});
 if(assignment.status!=="assigned")return jsonError("This assignment cannot be accepted.",409);
 const {error}=await db.from("job_assignments").update({status:"accepted"}).eq("id",assignment.id).eq("status","assigned");
 if(error)return jsonError("Could not accept Work Order.",500);
 await db.from("audit_events").insert({business_id:membership.business_id,actor_user_id:user.id,action:"work_order.assignment_accepted",entity_type:"job",entity_id:id,details:{staff_id:staff.id}});
 return Response.json({success:true,status:"accepted"});
}
