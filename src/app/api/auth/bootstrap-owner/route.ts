import {database,normalizeEmail,passwordHash,createSession,jsonError,sameOrigin} from "@/lib/auth";
export const runtime="nodejs";
export async function POST(request:Request){
 if(!sameOrigin(request))return jsonError("Invalid request origin.",403);
 try{
  const secret=process.env.BRANDON_RV_SETUP_SECRET;if(!secret||request.headers.get("x-setup-secret")!==secret)return jsonError("Setup is not authorised.",401);
  const body=await request.json();const email=normalizeEmail(String(body.email??""));const fullName=String(body.fullName??"").trim();const password=String(body.password??"");
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||fullName.length<2||password.length<12||password.length>128)return jsonError("Provide a valid name, email and password of at least 12 characters.");
  const db=database();const {count}=await db.from("users").select("id",{count:"exact",head:true}).eq("user_role","owner");if((count??0)>0)return jsonError("An owner account has already been created.",409);
  const {data:business,error:businessError}=await db.from("businesses").select("id").eq("slug","brandon-rv").single();if(businessError||!business)return jsonError("Business setup is incomplete.",503);
  const now=new Date().toISOString();
  const {data:role}=await db.from("user_roles").select("role_key").eq("role_key","owner").maybeSingle();if(!role)return jsonError("User role setup is incomplete.",503);
  const {data:user,error}=await db.from("users").insert({email,full_name:fullName,first_name:fullName.split(/\s+/)[0]??fullName,last_name:fullName.split(/\s+/).slice(1).join(" ")||null,password_hash:await passwordHash(password),account_type:"customer",status:"active",email_verified_at:now,primary_group:"customer",secondary_group:null,business_id:business.id,user_role:"owner",employee_number:"OWNER",job_title:"Owner",employment_status:"active",employment_type:"full_time",start_date:now.slice(0,10)}).select("id,email,full_name,account_type").single();if(error||!user)return jsonError("Could not create owner account.",500);
  await createSession(user.id,request);return Response.json({user:{...user,account_type:"customer"}},{status:201});
 }catch{return jsonError("Owner setup failed.",500);}
}