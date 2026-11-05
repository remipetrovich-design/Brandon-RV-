import {database,normalizeEmail,passwordHash,createSession,jsonError,sameOrigin} from "@/lib/auth";
export const runtime="nodejs";
export async function POST(request:Request){
 if(!sameOrigin(request))return jsonError("Invalid request origin.",403);
 try{
  const secret=process.env.BRANDON_RV_SETUP_SECRET;if(!secret||request.headers.get("x-setup-secret")!==secret)return jsonError("Setup is not authorised.",401);
  const body=await request.json();const email=normalizeEmail(String(body.email??""));const fullName=String(body.fullName??"").trim();const password=String(body.password??"");
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||fullName.length<2||password.length<12||password.length>128)return jsonError("Provide a valid name, email and password of at least 12 characters.");
  const db=database();const {count}=await db.from("users").select("id",{count:"exact",head:true}).eq("account_type","owner");if((count??0)>0)return jsonError("An owner account has already been created.",409);
  const {data:business,error:businessError}=await db.from("businesses").select("id").eq("slug","brandon-rv").single();if(businessError||!business)return jsonError("Business setup is incomplete.",503);
  const {data:user,error}=await db.from("users").insert({email,full_name:fullName,password_hash:await passwordHash(password),account_type:"owner",status:"active",email_verified_at:new Date().toISOString(),primary_group:"staff",secondary_group:null,business_id:business.id}).select("id,email,full_name,account_type").single();if(error||!user)return jsonError("Could not create owner account.",500);
  const now=new Date().toISOString();
  const {error:memberError}=await db.from("business_members").insert({business_id:business.id,user_id:user.id,role:"owner",is_active:true,joined_at:now});
  if(memberError){await db.from("users").delete().eq("id",user.id);return jsonError("Could not assign owner access.",500);}
  const {error:staffError}=await db.from("staff").insert({business_id:business.id,user_id:user.id,employee_number:"OWNER",job_title:"Owner",employment_status:"active",start_date:now.slice(0,10)});
  if(staffError){await db.from("business_members").delete().eq("user_id",user.id);await db.from("users").delete().eq("id",user.id);return jsonError("Could not create the owner employee profile.",500);}
  await createSession(user.id,request);return Response.json({user},{status:201});
 }catch{return jsonError("Owner setup failed.",500);}
}