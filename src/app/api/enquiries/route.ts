import {randomUUID} from "node:crypto";
import {currentUser,database,normalizeEmail,jsonError,sameOrigin} from "@/lib/auth";
import {sendTemplateEmail} from "@/lib/email";
export const runtime="nodejs";
const allowedTypes=new Set(["image/jpeg","image/png","image/webp","application/pdf"]);
export async function POST(request:Request){
 if(!sameOrigin(request))return jsonError("Invalid request origin.",403);
 try{
  const form=await request.formData();
  const first=String(form.get("firstName")??"").trim();const last=String(form.get("lastName")??"").trim();const submittedName=(first+" "+last).trim();
  const submittedEmail=String(form.get("email")??"");const submittedPhone=String(form.get("phone")??"").trim();
  const user=await currentUser();
  const customerAccount=user?.account_type==="customer"?user:null;
  const name=customerAccount?customerAccount.full_name:submittedName;
  const email=normalizeEmail(customerAccount?customerAccount.email:submittedEmail);
  const phone=String(customerAccount?.phone??submittedPhone).trim();
  const vehicleType=String(form.get("vehicleType")??"").trim();const vehicle=String(form.get("vehicle")??"").trim();const year=String(form.get("year")??"").trim();const location=String(form.get("location")??"").trim();
  const workType=String(form.get("workType")??"").trim();const description=String(form.get("description")??"").trim();
  if(name.length<3||name.length>120||!/^\S+@\S+\.\S+$/.test(email)||email.length>254||phone.length<6||phone.length>40)return jsonError("Enter valid contact details.");
  if(!vehicleType||!location||location.length>160||!workType||description.length<10||description.length>5000)return jsonError("Complete the vehicle, location and job description fields.");
  const files=form.getAll("files").filter((x):x is File=>x instanceof File&&x.size>0);
  if(files.length>8||files.some(f=>f.size>10*1024*1024||!allowedTypes.has(f.type)))return jsonError("Attach up to 8 JPG, PNG, WEBP or PDF files. Each file must be under 10 MB.");
  const db=database();const since=new Date(Date.now()-15*60*1000).toISOString();const {count}=await db.from("enquiries").select("id",{count:"exact",head:true}).eq("email",email).gte("created_at",since);
  if((count??0)>=5)return jsonError("Too many enquiries from this email. Please try again later.",429);
  const {data:business,error:businessError}=await db.from("businesses").select("id").eq("slug","brandon-rv").single();if(businessError||!business)return jsonError("Enquiry service is unavailable.",503);
  let customerId:string|null=null;let userId:string|null=null;
  if(customerAccount){userId=customerAccount.id;const {data:customer}=await db.from("customers").select("id").eq("user_id",customerAccount.id).maybeSingle();customerId=customer?.id??null;}
  const vehicleDescription=[vehicleType,vehicle,year].filter(Boolean).join(" · ");
  const {data:enquiry,error}=await db.from("enquiries").insert({business_id:business.id,customer_id:customerId,user_id:userId,contact_name:name,email,phone,location,vehicle_description:vehicleDescription,requested_service:workType,description,preferred_contact:"email",status:"new",source:"website"}).select("id").single();
  if(error||!enquiry)return jsonError("Could not submit your enquiry. Please try again.",500);
  const uploaded:string[]=[];
  for(const file of files){
   const safe=file.name.replace(/[^a-zA-Z0-9._-]/g,"_").slice(-100)||"attachment";
   const path=business.id+"/"+enquiry.id+"/"+randomUUID()+"-"+safe;
   const {error:uploadError}=await db.storage.from("brandon-rv-private").upload(path,file,{contentType:file.type,upsert:false});
   if(uploadError){if(uploaded.length)await db.storage.from("brandon-rv-private").remove(uploaded);await db.from("enquiries").delete().eq("id",enquiry.id);return jsonError("A file could not be uploaded. Please try again.",500);}
   uploaded.push(path);
   const {error:attachmentError}=await db.from("enquiry_attachments").insert({business_id:business.id,enquiry_id:enquiry.id,uploaded_by:userId,storage_path:path,file_name:file.name.slice(0,255),mime_type:file.type,size_bytes:file.size});
   if(attachmentError){await db.storage.from("brandon-rv-private").remove(uploaded);await db.from("enquiries").delete().eq("id",enquiry.id);return jsonError("Could not save enquiry attachments.",500);}
  }
  await sendTemplateEmail({key:"enquiry_received",to:email,name,buttonUrl:(process.env.NEXT_PUBLIC_APP_URL??new URL(request.url).origin)+"/portal"});
  return Response.json({success:true,message:"Your enquiry has been sent. Brandon RV will review the details and contact you."},{status:201});
 }catch{return jsonError("Could not submit your enquiry.",500);}
}