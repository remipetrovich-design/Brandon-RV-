import {createHash} from "node:crypto";
import {createSession,database,normalizeEmail,passwordMatches,jsonError,sameOrigin} from "@/lib/auth";
export const runtime="nodejs";
export async function POST(request:Request){
 if(!sameOrigin(request))return jsonError("Invalid request origin.",403);
 try{
  const body=await request.json();const email=normalizeEmail(String(body.email??""));const password=String(body.password??"");
  if(!email||!password||email.length>254||password.length>128)return jsonError("Enter your email and password.",400);
  const db=database();const ip=request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()??"unknown";const ipHash=createHash("sha256").update(ip).digest("hex");const since=new Date(Date.now()-15*60*1000).toISOString();
  const {count}=await db.from("login_attempts").select("id",{count:"exact",head:true}).eq("attempt_type","login").eq("email",email).eq("ip_hash",ipHash).eq("succeeded",false).gte("attempted_at",since);
  if((count??0)>=8)return jsonError("Too many attempts. Try again in 15 minutes.",429);
  const {data:user}=await db.from("users").select("id,email,full_name,phone,account_type,status,password_hash,email_verified_at,force_password_change,primary_group,secondary_group").eq("email",email).maybeSingle();
  const valid=!!user&&user.status==="active"&&await passwordMatches(password,user.password_hash);
  await db.from("login_attempts").insert({attempt_type:"login",email,ip_hash:ipHash,succeeded:valid});
  if(!valid||!user)return jsonError("Email or password is incorrect.",401);
  await db.from("users").update({last_login_at:new Date().toISOString(),updated_at:new Date().toISOString(),primary_group:"customer"}).eq("id",user.id);
  await createSession(user.id,request);const {password_hash:_passwordHash,...safeUser}=user;const {data:membership}=await db.from("business_members").select("id").eq("user_id",user.id).eq("is_active",true).limit(1).maybeSingle();return Response.json({user:{...safeUser,account_type:"customer",primary_group:"customer"},hasBusinessAccess:!!membership});
 }catch{return jsonError("Sign-in is temporarily unavailable.",500);}
}
