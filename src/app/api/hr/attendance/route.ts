import {authorizePermission,database,jsonError,sameOrigin,userHasPermission} from "@/lib/auth";
export const runtime="nodejs";
export async function GET(){
 const access=await authorizePermission("time.clock");if(access.response)return access.response;
 const db=database(),businessId=access.membership!.business_id,manager=await userHasPermission(access.user!.id,"time.manage");
 let q=db.from("attendance_entries").select("id,user_id,clock_in,clock_out,break_minutes,notes,approved_at,approved_by").eq("business_id",businessId).order("clock_in",{ascending:false}).limit(200);
 if(!manager)q=q.eq("user_id",access.user!.id);
 const {data,error}=await q;if(error)return jsonError("Could not load attendance records.",500);
 return Response.json({entries:data??[],canManage:manager});
}
export async function POST(request:Request){
 if(!sameOrigin(request))return jsonError("Invalid request origin.",403);
 const access=await authorizePermission("time.clock");if(access.response)return access.response;
 try{
  const body=await request.json(),db=database(),businessId=access.membership!.business_id,userId=access.user!.id,now=new Date().toISOString();
  if(body.action==="clock_in"){
   const {data:open}=await db.from("attendance_entries").select("id").eq("business_id",businessId).eq("user_id",userId).is("clock_out",null).maybeSingle();
   if(open)return jsonError("You are already clocked in.",409);
   const {data,error}=await db.from("attendance_entries").insert({business_id:businessId,user_id:userId,clock_in:now}).select("id,clock_in,clock_out,break_minutes").single();
   if(error||!data)return jsonError("Could not clock in.",500);return Response.json({entry:data},{status:201});
  }
  if(body.action==="clock_out"){
   const {data:entry}=await db.from("attendance_entries").select("id,clock_in").eq("business_id",businessId).eq("user_id",userId).is("clock_out",null).maybeSingle();
   if(!entry)return jsonError("You are not currently clocked in.",409);
   const {data,error}=await db.from("attendance_entries").update({clock_out:now,break_minutes:Math.max(0,Math.min(1440,Number(body.breakMinutes)||0)),notes:String(body.notes??"").slice(0,1000)||null}).eq("id",entry.id).is("clock_out",null).select("id,clock_in,clock_out,break_minutes").single();
   if(error||!data)return jsonError("Could not clock out.",500);return Response.json({entry:data});
  }
  return jsonError("Choose clock_in or clock_out.");
 }catch{return jsonError("Could not update attendance.",500);}
}
export async function PATCH(request:Request){
 if(!sameOrigin(request))return jsonError("Invalid request origin.",403);
 const access=await authorizePermission("time.manage");if(access.response)return access.response;
 try{const {id,approved}=await request.json();const {data,error}=await database().from("attendance_entries").update({approved_at:approved?new Date().toISOString():null,approved_by:approved?access.user!.id:null}).eq("id",String(id)).eq("business_id",access.membership!.business_id).not("clock_out","is",null).select("id").maybeSingle();if(error||!data)return jsonError("Attendance entry not found or still open.",404);return Response.json({success:true});}catch{return jsonError("Could not update attendance approval.",500);}
}
