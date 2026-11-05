import {currentUser,currentMembership,database,userHasPermission,jsonError,sameOrigin} from "@/lib/auth";
export const runtime="nodejs";
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
 if(!sameOrigin(request))return jsonError("Invalid request origin.",403);const user=await currentUser();if(!user)return jsonError("Not signed in.",401);const membership=await currentMembership(user.id);if(!membership||!(await userHasPermission(user.id,"payments.manage")))return jsonError("You do not have permission to record payments.",403);
 try{
  const {id}=await params;const body=await request.json();const amount=Number(body.amount);const method=String(body.method??"other");const reference=String(body.reference??"").trim().slice(0,120);
  if(!Number.isFinite(amount)||amount<=0||amount>10000000)return jsonError("Enter a valid payment amount.");if(!["cash","bank_transfer","card","other"].includes(method))return jsonError("Select a valid payment method.");
  const db=database();const {data:invoice}=await db.from("invoices").select("id,customer_id,user_id,total,amount_paid,status").eq("id",id).eq("business_id",membership.business_id).maybeSingle();if(!invoice)return jsonError("Invoice not found.",404);
  if(["draft","void","paid"].includes(invoice.status))return jsonError("This invoice cannot accept another payment.",409);
  const balance=Number(invoice.total)-Number(invoice.amount_paid);if(amount>balance+0.005)return jsonError("Payment exceeds the outstanding balance.");
  const {data:payment,error}=await db.from("payments").insert({business_id:membership.business_id,invoice_id:id,customer_id:invoice.customer_id,user_id:invoice.user_id,amount,method,reference:reference||null,status:"recorded",paid_at:new Date().toISOString()}).select("id,amount,paid_at").single();
  if(error||!payment)return jsonError("Could not record payment.",500);
  const amountPaid=Number((Number(invoice.amount_paid)+amount).toFixed(2));const nextStatus=amountPaid+0.005>=Number(invoice.total)?"paid":"part_paid";
  const {error:updateError}=await db.from("invoices").update({amount_paid:amountPaid,status:nextStatus,updated_at:new Date().toISOString()}).eq("id",id);
  if(updateError){await db.from("payments").delete().eq("id",payment.id);return jsonError("Payment was recorded but the invoice balance could not be updated. Contact support.",500);}
  await db.from("audit_events").insert({business_id:membership.business_id,actor_user_id:user.id,action:"payment.recorded",entity_type:"payment",entity_id:payment.id,details:{invoice_id:id,amount,method}});
  return Response.json({success:true,payment,amountPaid,balance:Number((Number(invoice.total)-amountPaid).toFixed(2)),invoiceStatus:nextStatus});
 }catch{return jsonError("Could not record payment.",500);}
}