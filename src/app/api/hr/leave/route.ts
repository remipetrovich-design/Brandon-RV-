import {authorizePermission,database,jsonError,sameOrigin,userHasPermission} from "@/lib/auth";
export const runtime="nodejs";
export async function GET(){
 const a=await authorizePermission("leave.view");if(a.response)return a.response;
 const db=database(),businessId=a.membership!.business_id,manager=await userHasPermission(a.user!.id,"leave.manage");
 const [types,requests,balances]=await Promise.all([db.from("leave_types").select("id,name,paid,annual_entitlement_days").eq("business_id",businessId).eq("is_active",true).order("name"),db.from("leave_requests").select("id,user_id,leave_type_id,start_date,end_date,days,reason,status,reviewer_note,created_at").eq("business_id",businessId).order("created_at",{ascending:false}).limit(200),db.from("leave_balances").select("id,user_id,leave_type_id,opening_balance_days,accrued_days,used_days").eq("business_id",businessId)]);
 if(types.error||requests.error||balances.error)return jsonError("Could not load leave records.",500);
 return Response.json({types:types.data??[],requests:manager?requests.data??[]:(requests.data??[]).filter(x=>x.user_id===a.user!.id),balances:(balances.data??[]).filter(x=>manager||x.user_id===a.user!.id),canManage:manager});
}
export async function POST(request:Request){
 if(!sameOrigin(request))return jsonError("Invalid request origin.",403);
 const a=await authorizePermission("leave.view");if(a.response)return a.response;
 try{const b=await request.json(),start=String(b.startDate??""),end=String(b.endDate??""),days=Number(b.days),reason=String(b.reason??"").slice(0,2000);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(start)||!/^\d{4}-\d{2}-\d{2}$/.test(end)||end<start||!Number.isFinite(days)||days<=0||days>366)return jsonError("Enter valid leave dates and days.");
 const db=database();const {data:leaveType}=await db.from("leave_types").select("id").eq("id",String(b.leaveTypeId)).eq("business_id",a.membership!.business_id).eq("is_active",true).maybeSingle();if(!leaveType)return jsonError("Select a valid leave type.");
 const {data,error}=await db.from("leave_requests").insert({business_id:a.membership!.business_id,user_id:a.user!.id,leave_type_id:leaveType.id,start_date:start,end_date:end,days,reason:reason||null}).select("id").single();
 if(error||!data)return jsonError("Could not submit leave request.",500);return Response.json({success:true,id:data.id},{status:201});
 }catch{return jsonError("Could not submit leave request.",500);}
}
export async function PATCH(request:Request){
 if(!sameOrigin(request))return jsonError("Invalid request origin.",403);
 const a=await authorizePermission("leave.manage");if(a.response)return a.response;
 try{const b=await request.json(),status=String(b.status);if(!["approved","rejected"].includes(status))return jsonError("Invalid leave decision.");
 const db=database(),businessId=a.membership!.business_id;
 const {data:req,error}=await db.from("leave_requests").update({status,reviewed_by:a.user!.id,reviewed_at:new Date().toISOString(),reviewer_note:String(b.note??"").slice(0,1000)||null}).eq("id",String(b.id)).eq("business_id",businessId).eq("status","pending").select("id,user_id,leave_type_id,days").maybeSingle();
 if(error||!req)return jsonError("Pending leave request not found.",404);
 if(status==="approved"){const {data:balance}=await db.from("leave_balances").select("id,used_days").eq("user_id",req.user_id).eq("leave_type_id",req.leave_type_id).maybeSingle();if(balance)await db.from("leave_balances").update({used_days:Number(balance.used_days)+Number(req.days),updated_at:new Date().toISOString()}).eq("id",balance.id);}
 return Response.json({success:true});
 }catch{return jsonError("Could not update leave request.",500);}
}
