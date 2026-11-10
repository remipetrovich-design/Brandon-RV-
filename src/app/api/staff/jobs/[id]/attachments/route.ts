import {currentUser,currentMembership,database,jsonError,sameOrigin} from "@/lib/auth";
export const runtime="nodejs";
const bucket="brandon-rv-private";
const allowedTypes=new Set(["image/jpeg","image/png","image/webp","image/heic","image/heif"]);
async function access(jobId:string,userId:string,businessId:string,write=false){
 const db=database();
 const [{data:staff},{data:job}]=await Promise.all([
  db.from("staff").select("id").eq("user_id",userId).eq("business_id",businessId).maybeSingle(),
  db.from("jobs").select("id,status").eq("id",jobId).eq("business_id",businessId).maybeSingle()
 ]);
 if(!staff||!job)return {db,staff:null,job:null,allowed:false};
 const {data:assignment}=await db.from("job_assignments").select("status").eq("job_id",jobId).eq("staff_id",staff.id).maybeSingle();
 const allowed=write?assignment?.status==="accepted"&&job.status==="in_progress":["accepted","completed"].includes(String(assignment?.status));
 return {db,staff,job,allowed};
}
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
 const user=await currentUser();if(!user)return jsonError("Not signed in.",401);
 const membership=await currentMembership(user.id);if(!membership)return jsonError("Staff access required.",403);
 const {id}=await params;const ctx=await access(id,user.id,membership.business_id,false);
 if(!ctx.allowed)return jsonError("Workcard not found or not assigned to you.",404);
 const {data,error}=await ctx.db.from("job_attachments").select("id,file_name,mime_type,size_bytes,customer_visible,created_at,storage_path").eq("business_id",membership.business_id).eq("job_id",id).order("created_at",{ascending:false});
 if(error)return jsonError("Could not load Workcard attachments.",500);
 const attachments=await Promise.all((data??[]).map(async item=>{const {data:signed}=await ctx.db.storage.from(bucket).createSignedUrl(item.storage_path,300);return {...item,url:signed?.signedUrl??null};}));
 return Response.json({attachments});
}
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
 if(!sameOrigin(request))return jsonError("Invalid request origin.",403);
 const user=await currentUser();if(!user)return jsonError("Not signed in.",401);
 const membership=await currentMembership(user.id);if(!membership)return jsonError("Staff access required.",403);
 const {id}=await params;const ctx=await access(id,user.id,membership.business_id,true);
 if(!ctx.allowed)return jsonError("Accept the assigned Workcard and start work before uploading evidence.",409);
 try{
  const form=await request.formData();
  const files=form.getAll("files").filter((value):value is File=>value instanceof File&&value.size>0);
  if(!files.length||files.length>8)return jsonError("Choose between 1 and 8 photos.");
  if(files.some(file=>!allowedTypes.has(file.type)||file.size>10*1024*1024))return jsonError("Photos must be JPEG, PNG, WebP or HEIC files under 10 MB each.");
  const customerVisible=form.get("customerVisible")==="true";
  const uploaded:string[]=[];const records:any[]=[];
  for(const file of files){
   const safeName=file.name.replace(/[^a-zA-Z0-9._-]/g,"_").slice(-100)||"workcard-photo";
   const path=membership.business_id+"/workcards/"+id+"/"+crypto.randomUUID()+"-"+safeName;
   const {error:uploadError}=await ctx.db.storage.from(bucket).upload(path,file,{contentType:file.type,upsert:false});
   if(uploadError){await ctx.db.storage.from(bucket).remove(uploaded);await ctx.db.from("job_attachments").delete().eq("job_id",id).in("storage_path",uploaded);return jsonError("Could not upload Workcard photos. The upload was rolled back.",500);}
   uploaded.push(path);
   const {data:record,error:recordError}=await ctx.db.from("job_attachments").insert({business_id:membership.business_id,job_id:id,storage_path:path,file_name:file.name.slice(0,180),mime_type:file.type,size_bytes:file.size,customer_visible:customerVisible,uploaded_by:user.id}).select("id,file_name,mime_type,size_bytes,customer_visible,created_at,storage_path").single();
   if(recordError||!record){await ctx.db.storage.from(bucket).remove(uploaded);await ctx.db.from("job_attachments").delete().eq("job_id",id).in("storage_path",uploaded);return jsonError("Could not save Workcard photo details. The upload was rolled back.",500);}
   records.push(record);
  }
  await ctx.db.from("audit_events").insert({business_id:membership.business_id,actor_user_id:user.id,action:"workcard.attachments_uploaded",entity_type:"job",entity_id:id,details:{attachment_ids:records.map(x=>x.id),count:records.length,customer_visible:customerVisible}});
  const attachments=await Promise.all(records.map(async item=>{const {data:signed}=await ctx.db.storage.from(bucket).createSignedUrl(item.storage_path,300);return {...item,url:signed?.signedUrl??null};}));
  return Response.json({attachments},{status:201});
 }catch{return jsonError("Could not upload Workcard photos.",500);}
}
