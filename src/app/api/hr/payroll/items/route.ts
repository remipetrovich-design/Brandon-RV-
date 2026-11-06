import {authorizePermission,database,jsonError,sameOrigin} from "@/lib/auth";
export const runtime="nodejs";
const amount=(v:any)=>{const n=Number(v??0);return Number.isFinite(n)&&n>=0&&n<=9999999999.99?n:null;};
export async function POST(request:Request){
 if(!sameOrigin(request))return jsonError("Invalid request origin.",403);
 const a=await authorizePermission("payroll.manage");if(a.response)return a.response;
 try{
  const b=await request.json(),periodId=String(b.periodId??""),userId=String(b.userId??"");
  if(!/^[0-9a-f-]{36}$/i.test(periodId)||!/^[0-9a-f-]{36}$/i.test(userId))return jsonError("Select a payroll period and employee.");
  const ordinary=amount(b.ordinaryHours),overtime=amount(b.overtimeHours),allowances=amount(b.allowances),deductions=amount(b.deductions),gross=amount(b.grossAmount),tax=amount(b.taxWithheld),superAmount=amount(b.superannuationAmount);
  if(ordinary===null||overtime===null||allowances===null||deductions===null||gross===null||tax===null||superAmount===null)return jsonError("Enter valid non-negative payroll amounts.");
  if(deductions!+tax!>gross!)return jsonError("Deductions and tax cannot exceed gross pay.");
  const db=database(),businessId=a.membership!.business_id;
  const [period,user]=await Promise.all([db.from("payroll_periods").select("id,status").eq("id",periodId).eq("business_id",businessId).maybeSingle(),db.from("users").select("id").eq("id",userId).eq("business_id",businessId).eq("employment_status","active").maybeSingle()]);
  if(!period.data||!["draft","review"].includes(period.data.status))return jsonError("Payroll period is not open for editing.",409);
  if(!user.data)return jsonError("Active employee not found.",404);
  const {data,error}=await db.from("payroll_items").upsert({business_id:businessId,payroll_period_id:periodId,user_id:userId,ordinary_hours:ordinary,overtime_hours:overtime,allowances,deductions,gross_amount:gross,tax_withheld:tax,superannuation_amount:superAmount,net_amount:gross-deductions-tax,notes:String(b.notes??"").slice(0,2000)||null},{onConflict:"payroll_period_id,user_id"}).select("id").single();
  if(error||!data)return jsonError("Could not save payroll entry.",500);
  return Response.json({success:true,id:data.id},{status:201});
 }catch{return jsonError("Could not save payroll entry.",500);}
}
