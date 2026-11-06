import {authorizePermission,database,jsonError,sameOrigin,userHasPermission} from "@/lib/auth";
export const runtime="nodejs";
export async function GET(){
 const a=await authorizePermission("payroll.view");if(a.response)return a.response;
 const db=database(),businessId=a.membership!.business_id;
 const {data:periods,error}=await db.from("payroll_periods").select("id,name,period_start,period_end,pay_date,status,notes,created_at").eq("business_id",businessId).order("period_start",{ascending:false}).limit(100);
 if(error)return jsonError("Could not load payroll periods.",500);
 const ids=(periods??[]).map(x=>x.id);
 const result=ids.length?await db.from("payroll_items").select("id,payroll_period_id,user_id,ordinary_hours,overtime_hours,allowances,deductions,gross_amount,tax_withheld,superannuation_amount,net_amount,notes").eq("business_id",businessId).in("payroll_period_id",ids):{data:[],error:null};
 if(result.error)return jsonError("Could not load payroll entries.",500);
 const canManage=await userHasPermission(a.user!.id,"payroll.manage");const {data:employees}=canManage?await db.from("users").select("id,full_name,email,pay_rate,pay_frequency").eq("business_id",businessId).eq("employment_status","active").order("full_name"):{data:[]};
 return Response.json({periods:periods??[],items:result.data??[],employees:employees??[],canManage});
}
export async function POST(request:Request){
 if(!sameOrigin(request))return jsonError("Invalid request origin.",403);
 const a=await authorizePermission("payroll.manage");if(a.response)return a.response;
 try{const b=await request.json(),start=String(b.periodStart??""),end=String(b.periodEnd??""),name=String(b.name??"").trim();
 if(!name||name.length>120||!/^\d{4}-\d{2}-\d{2}$/.test(start)||!/^\d{4}-\d{2}-\d{2}$/.test(end)||end<start)return jsonError("Enter a name and valid payroll period dates.");
 const {data,error}=await database().from("payroll_periods").insert({business_id:a.membership!.business_id,name,period_start:start,period_end:end,pay_date:b.payDate||null,notes:String(b.notes??"").slice(0,2000)||null,created_by:a.user!.id}).select("id").single();
 if(error||!data)return jsonError("Could not create payroll period.",500);return Response.json({success:true,id:data.id},{status:201});
 }catch{return jsonError("Could not create payroll period.",500);}
}
export async function PATCH(request:Request){
 if(!sameOrigin(request))return jsonError("Invalid request origin.",403);
 const a=await authorizePermission("payroll.manage");if(a.response)return a.response;
 try{const b=await request.json(),status=String(b.status);if(!["review","approved","paid","void"].includes(status))return jsonError("Invalid payroll status.");
 const update:any={status};if(status==="approved"){update.approved_by=a.user!.id;update.approved_at=new Date().toISOString();}
 const allowedFrom:Record<string,string[]>={review:["draft"],approved:["review"],paid:["approved"],void:["draft","review"]};const {data,error}=await database().from("payroll_periods").update(update).eq("id",String(b.id)).eq("business_id",a.membership!.business_id).in("status",allowedFrom[status]).select("id").maybeSingle();
 if(error||!data)return jsonError("Payroll period could not be updated.",409);return Response.json({success:true});
 }catch{return jsonError("Could not update payroll period.",500);}
}
