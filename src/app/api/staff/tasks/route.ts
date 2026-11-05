import {currentUser,currentMembership,database,jsonError} from "@/lib/auth";
export const runtime="nodejs";
export async function GET(){
 const user=await currentUser();if(!user)return jsonError("Not signed in.",401);const membership=await currentMembership(user.id);if(!membership)return jsonError("Staff access required.",403);
 const db=database();const {data:staff}=await db.from("staff").select("id").eq("user_id",user.id).eq("business_id",membership.business_id).maybeSingle();if(!staff)return jsonError("Employee profile not found.",404);
 const {data:tasks,error}=await db.from("job_tasks").select("id,job_id,title,description,status,due_at").eq("business_id",membership.business_id).eq("assigned_staff_id",staff.id).in("status",["pending","in_progress","blocked"]).order("due_at",{ascending:true});
 if(error)return jsonError("Could not load tasks.",500);return Response.json({tasks:tasks??[]});
}