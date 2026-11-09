import {randomBytes,randomUUID} from "node:crypto";
import {currentUser,database,normalizeEmail,jsonError,sameOrigin,digest} from "@/lib/auth";
import {sendBrandonRvTemplateEmail,sendEmail} from "@/lib/email";
export const runtime="nodejs";
const allowedTypes=new Set(["image/jpeg","image/png","image/webp","application/pdf"]);
const requestNumber=()=> "BRV-RQ-"+new Date().toISOString().slice(2,10).replaceAll("-","")+"-"+randomBytes(3).toString("hex").toUpperCase();
export async function POST(request:Request){
 if(!sameOrigin(request))return jsonError("Invalid request origin.",403);
 try{
  const form=await request.formData();const requestType=String(form.get("requestType")??"quote_request");
  if(!["public_enquiry","general_enquiry","quote_request"].includes(requestType))return jsonError("Invalid enquiry type.");
  const first=String(form.get("firstName")??"").trim();const last=String(form.get("lastName")??"").trim();
  const submittedName=(first+" "+last).trim();const submittedEmail=String(form.get("email")??"");
  const submittedPhone=String(form.get("phone")??"").trim();const user=await currentUser();
  const account=user?.account_type==="customer"?user:null;
  const name=account?.full_name??submittedName;const email=normalizeEmail(account?.email??submittedEmail);
  const phone=String(account?.phone??submittedPhone).trim();
  if(name.length<3||name.length>120||!/^\S+@\S+\.\S+$/.test(email)||email.length>254||phone.length<6||phone.length>40)return jsonError("Enter valid contact details.");
  const db=database();const since=new Date(Date.now()-15*60*1000).toISOString();
  const {count}=await db.from("enquiries").select("id",{count:"exact",head:true}).eq("email",email).gte("created_at",since);
  if((count??0)>=5)return jsonError("Too many enquiries from this email. Please try again later.",429);
  const {data:business,error:businessError}=await db.from("businesses").select("id").eq("slug","brandon-rv").single();
  if(businessError||!business)return jsonError("Enquiry service is unavailable.",503);
  const {data:businessSettings}=await db.from("business_settings").select("settings").eq("business_id",business.id).maybeSingle();
  const configured=businessSettings?.settings&&typeof businessSettings.settings==="object"?businessSettings.settings as Record<string,unknown>:{};
  if(configured.accepting_enquiries===false)return jsonError("Brandon RV is not accepting new enquiries at the moment. Please contact the business directly.",503);
  const reference=requestNumber();let guestToken:string|null=null;
  if(requestType==="general_enquiry"||requestType==="public_enquiry"){
   const description=String(form.get("message")??"").trim();
   if(description.length<5||description.length>5000)return jsonError("Enter a message between 5 and 5,000 characters.");
   const {data:enquiry,error}=await db.from("enquiries").insert({business_id:business.id,customer_id:account?.id??null,user_id:account?.id??null,contact_name:name,email,phone,requested_service:requestType==="public_enquiry"?"Public Contact form":"General enquiry",description,preferred_contact:"email",status:"new",source:requestType==="public_enquiry"?"contact_page":"website",request_type:requestType,request_number:reference}).select("id").single();
   if(error||!enquiry)return jsonError("Could not submit your enquiry. Please try again.",500);
   await sendBrandonRvTemplateEmail({templateId:"enquiry_received",sender:"noreply",to:email,variables:{firstname:first,lastname:last,enquiry_number:reference,service:"General enquiry",vehicle:"",suburb:"",enquiry_url:process.env.NEXT_PUBLIC_APP_URL??new URL(request.url).origin}});
   return Response.json({success:true,referenceNumber:reference,message:"Your public enquiry has been sent. It is not a quote request or booking."},{status:201});
  }
  const vehicleType=String(form.get("vehicleType")??"").trim();const vehicle=String(form.get("vehicle")??"").trim();
  const year=String(form.get("year")??"").trim();const requestedVehicleId=String(form.get("vehicleId")??"").trim();const location=String(form.get("location")??"").trim();
  const workType=String(form.get("workType")??"").trim();const description=String(form.get("description")??"").trim();
  if((!requestedVehicleId&&!vehicleType)||!location||location.length>160||!workType||description.length<10||description.length>5000)return jsonError("Complete the vehicle, location and job description fields.");
  const files=form.getAll("files").filter((x):x is File=>x instanceof File&&x.size>0);
  if(files.length>8||files.some(f=>f.size>10*1024*1024||!allowedTypes.has(f.type)))return jsonError("Attach up to 8 JPG, PNG, WEBP or PDF files. Each file must be under 10 MB.");
  let vehicleId:string|null=null;let vehicleDescription=[vehicleType,vehicle,year].filter(Boolean).join(" · ");
  if(account){
   if(requestedVehicleId){const {data:existingVehicle}=await db.from("vehicles").select("id,make,model,year,vehicle_type").eq("id",requestedVehicleId).eq("customer_id",account.id).maybeSingle();if(!existingVehicle)return jsonError("Select one of your saved vehicles.");vehicleId=existingVehicle.id;vehicleDescription=[existingVehicle.vehicle_type,existingVehicle.make,existingVehicle.model,existingVehicle.year].filter(Boolean).join(" · ");}
   else if(vehicle){const {data:savedVehicle}=await db.from("vehicles").insert({business_id:business.id,customer_id:account.id,make:vehicle.slice(0,80),year:year&&/^\d{4}$/.test(year)?Number(year):null,vehicle_type:vehicleType,notes:"Added from Request a Quote"}).select("id").single();vehicleId=savedVehicle?.id??null;}
  }else guestToken=randomBytes(32).toString("base64url");
  const {data:enquiry,error}=await db.from("enquiries").insert({business_id:business.id,customer_id:account?.id??null,user_id:account?.id??null,contact_name:name,email,phone,location,vehicle_description:vehicleDescription,vehicle_id:vehicleId,requested_service:workType,description,preferred_contact:"email",status:"new",source:"website",request_type:"quote_request",request_number:reference,guest_access_token_hash:guestToken?digest(guestToken):null,guest_access_expires_at:guestToken?new Date(Date.now()+90*86400000).toISOString():null}).select("id").single();
  if(error||!enquiry)return jsonError("Could not submit your quote request. Please try again.",500);
  const uploaded:string[]=[];
  for(const file of files){
   const safe=file.name.replace(/[^a-zA-Z0-9._-]/g,"_").slice(-100)||"attachment";
   const path=business.id+"/"+enquiry.id+"/"+randomUUID()+"-"+safe;
   const {error:uploadError}=await db.storage.from("brandon-rv-private").upload(path,file,{contentType:file.type,upsert:false});
   if(uploadError){if(uploaded.length)await db.storage.from("brandon-rv-private").remove(uploaded);await db.from("enquiries").delete().eq("id",enquiry.id);return jsonError("A file could not be uploaded. Please try again.",500);}
   uploaded.push(path);
   const {error:attachmentError}=await db.from("enquiry_attachments").insert({business_id:business.id,enquiry_id:enquiry.id,uploaded_by:account?.id??null,storage_path:path,file_name:file.name.slice(0,255),mime_type:file.type,size_bytes:file.size});
   if(attachmentError){await db.storage.from("brandon-rv-private").remove(uploaded);await db.from("enquiries").delete().eq("id",enquiry.id);return jsonError("Could not save enquiry attachments.",500);}
  }
  const base=process.env.NEXT_PUBLIC_APP_URL??new URL(request.url).origin;
  if(guestToken){const accessUrl=base+"/request-status?ticket="+encodeURIComponent(enquiry.id)+"&token="+encodeURIComponent(guestToken);await sendEmail({sender:"brandonrv",to:email,subject:"Your Brandon RV Request Quote access details · "+reference,html:"<p>Hi "+name.replace(/[&<>"]/g,"")+",</p><p>Your quote request has been received.</p><p>Request Quote ID: <strong>"+reference+"</strong></p><p>Use the secure link below to view quotes and message Brandon RV. Keep this email private.</p><p><a href=\""+accessUrl+"\">Open your Request Quote conversation</a></p><p>This is not a confirmed booking. The date, time and location must be agreed separately.</p>"});}else await sendBrandonRvTemplateEmail({templateId:"enquiry_received",sender:"noreply",to:email,variables:{firstname:first,lastname:last,enquiry_number:reference,service:workType,vehicle:vehicleDescription,suburb:location,enquiry_url:base}});
  return Response.json({success:true,enquiryId:enquiry.id,referenceNumber:reference,guestAccessToken:guestToken,message:"Your quote request has been received. Keep your Request Quote ID"+(guestToken?" and guest access code":"")+" so you can return to this conversation. This is not a booking."},{status:201});
 }catch{return jsonError("Could not submit your enquiry.",500);}
}