import {authorizePermission,database,jsonError,sameOrigin} from "@/lib/auth";
export const runtime="nodejs";
const idPattern=/^[0-9a-f-]{36}$/i;

export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
 const access=await authorizePermission("quotes.manage");if(access.response)return access.response;
 const {id}=await params;if(!idPattern.test(id))return jsonError("Invalid quote ID.");
 const db=database(),businessId=access.membership!.business_id;
 const [{data:quote,error},{data:items,error:itemsError}]=await Promise.all([
  db.from("quotes").select("id,quote_number,revision_number,status,quote_kind,enquiry_id,total,subtotal,tax_amount,expiry_date,notes,terms,prepared_by,senior_approval_status,senior_approved_at,senior_approval_note,issue_date,supersedes_quote_id,created_at").eq("id",id).eq("business_id",businessId).maybeSingle(),
  db.from("quote_items").select("id,description,quantity,unit_price,tax_rate,line_total,sort_order").eq("quote_id",id).order("sort_order")
 ]);
 if(error||itemsError||!quote)return jsonError("Quote not found.",404);
 return Response.json({quote,items:items??[]});
}

export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}){
 if(!sameOrigin(request))return jsonError("Invalid request origin.",403);
 const access=await authorizePermission("quotes.manage");if(access.response)return access.response;
 const {id}=await params;if(!idPattern.test(id))return jsonError("Invalid quote ID.");
 try{
  const body=await request.json(),db=database(),businessId=access.membership!.business_id;
  const {data:quote}=await db.from("quotes").select("id,status,senior_approval_status,enquiry_id").eq("id",id).eq("business_id",businessId).maybeSingle();
  if(!quote)return jsonError("Quote not found.",404);
  if(!["draft"].includes(String(quote.status)))return jsonError("Only draft quotes can be edited. For an issued or accepted quote, create a new revision so the customer's existing offer and acceptance remain intact.",409);
  const raw=Array.isArray(body.items)?body.items:[];
  if(raw.length<1||raw.length>30)return jsonError("A quote must contain between 1 and 30 line items.");
  const items=raw.map((item:any,index:number)=>({description:String(item.description??"").trim(),quantity:Number(item.quantity??1),unit_price:Number(item.unit_price??item.unitPrice??0),tax_rate:Number(item.tax_rate??item.taxRate??0),sort_order:index}));
  if(items.some((x:any)=>x.description.length<3||x.description.length>500||!Number.isFinite(x.quantity)||x.quantity<=0||x.quantity>10000||!Number.isFinite(x.unit_price)||x.unit_price<0||x.unit_price>10000000||!Number.isFinite(x.tax_rate)||x.tax_rate<0||x.tax_rate>100))return jsonError("Check each quote line's description, quantity, unit price and tax rate.");
  const subtotal=Number(items.reduce((s:number,x:any)=>s+x.quantity*x.unit_price,0).toFixed(2));
  const taxAmount=Number(items.reduce((s:number,x:any)=>s+x.quantity*x.unit_price*x.tax_rate/100,0).toFixed(2));
  const total=Number((subtotal+taxAmount).toFixed(2));
  const expiryDate=body.expiryDate?String(body.expiryDate):null;
  if(expiryDate&&!/^\d{4}-\d{2}-\d{2}$/.test(expiryDate))return jsonError("Enter a valid expiry date.");
  const notes=String(body.notes??"").trim().slice(0,3000),terms=String(body.terms??"").trim().slice(0,3000);
  const {error:updateError}=await db.from("quotes").update({subtotal,tax_amount:taxAmount,total,expiry_date:expiryDate,notes:notes||null,terms:terms||null,senior_approval_status:"pending",senior_approved_by:null,senior_approved_at:null,senior_approval_note:"Quote edited. Senior review is required again.",updated_at:new Date().toISOString()}).eq("id",id).eq("business_id",businessId);
  if(updateError)return jsonError("Could not save quote changes.",500);
  const {error:deleteItemsError}=await db.from("quote_items").delete().eq("quote_id",id);
  if(deleteItemsError)return jsonError("Quote totals were updated but line items could not be replaced. Contact an administrator.",500);
  const {error:insertItemsError}=await db.from("quote_items").insert(items.map((x:any)=>({...x,quote_id:id,line_total:Number((x.quantity*x.unit_price).toFixed(2))})));
  if(insertItemsError)return jsonError("Quote details could not be saved. Contact an administrator.",500);
  await db.from("audit_events").insert({business_id:businessId,actor_user_id:access.user!.id,action:"quote.edited",entity_type:"quote",entity_id:id,details:{subtotal,tax_amount:taxAmount,total,line_count:items.length,senior_review_reset:true}});
  return Response.json({success:true,total,senior_approval_status:"pending"});
 }catch(error){console.error("Quote edit failed",error);return jsonError("Could not save quote changes.",500);}
}

export async function DELETE(request:Request,{params}:{params:Promise<{id:string}>}){
 if(!sameOrigin(request))return jsonError("Invalid request origin.",403);
 const access=await authorizePermission("quotes.manage");if(access.response)return access.response;
 const {id}=await params;if(!idPattern.test(id))return jsonError("Invalid quote ID.");
 const db=database(),businessId=access.membership!.business_id;
 const {data:quote}=await db.from("quotes").select("id,quote_number,status").eq("id",id).eq("business_id",businessId).maybeSingle();
 if(!quote)return jsonError("Quote not found.",404);
 if(quote.status!=="draft")return jsonError("Only draft quotes can be deleted. Issued, accepted or converted quotes must be retained for the customer and audit history; create a revision or close the quote instead.",409);
 const [{data:jobs},{data:revisions}]=await Promise.all([
  db.from("jobs").select("id").eq("business_id",businessId).eq("quote_id",id).limit(1),
  db.from("quotes").select("id").eq("business_id",businessId).eq("supersedes_quote_id",id).limit(1)
 ]);
 if(jobs?.length||revisions?.length)return jsonError("This quote is linked to a Workcard or later revision and cannot be deleted.",409);
 const {error:itemsError}=await db.from("quote_items").delete().eq("quote_id",id);
 if(itemsError)return jsonError("Could not remove quote line items.",500);
 const {error}=await db.from("quotes").delete().eq("id",id).eq("business_id",businessId);
 if(error)return jsonError("Could not delete quote.",500);
 await db.from("audit_events").insert({business_id:businessId,actor_user_id:access.user!.id,action:"quote.deleted",entity_type:"quote",entity_id:id,details:{quote_number:quote.quote_number}});
 return Response.json({success:true});
}
