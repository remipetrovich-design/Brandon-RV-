import {createHash} from "node:crypto";
import {database,normalizeEmail,digest,newToken,jsonError,sameOrigin} from "@/lib/auth";
import {isEmailConfigured,sendEmail} from "@/lib/email";
import {renderBrandonRvEmail} from "@/lib/email/templates.mjs";
export const runtime="nodejs";
export async function POST(request:Request){
 if(!sameOrigin(request))return jsonError("Invalid request origin.",403);
 if(!isEmailConfigured())return jsonError("Password recovery email is not configured. Contact Brandon RV to reset your account password.",503);
 try{
  const body=await request.json();const email=normalizeEmail(String(body.email??""));if(!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email))return jsonError("Enter a valid email address.");
  const db=database();const ip=request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()??"unknown";const ipHash=createHash("sha256").update(ip).digest("hex");const since=new Date(Date.now()-15*60*1000).toISOString();
  const {count}=await db.from("login_attempts").select("id",{count:"exact",head:true}).eq("attempt_type","password_reset").eq("email",email).eq("ip_hash",ipHash).gte("attempted_at",since);
  if((count??0)>=5)return Response.json({message:"If an active account exists for that email, a reset link has been sent."});
  await db.from("login_attempts").insert({attempt_type:"password_reset",email,ip_hash:ipHash,succeeded:true});
  const {data:user}=await db.from("users").select("id,full_name,first_name,last_name,email").eq("email",email).eq("status","active").maybeSingle();
  if(user){
   const token=newToken();await db.from("password_reset_tokens").delete().eq("user_id",user.id);
   const {error}=await db.from("password_reset_tokens").insert({user_id:user.id,token_hash:digest(token),expires_at:new Date(Date.now()+3600000).toISOString()});
   if(!error){
    const base=process.env.NEXT_PUBLIC_APP_URL??new URL(request.url).origin;const link=base+"/portal/reset-password?token="+encodeURIComponent(token);
    const message=renderBrandonRvEmail("forgot_password",{firstname:user.first_name||user.full_name,lastname:user.last_name,reset_url:link,expiry_time:"one hour"});
    await sendEmail({sender:"noreply",to:user.email,subject:message.subject,html:message.html});
   }
  }
  return Response.json({message:"If an active account exists for that email, a reset link has been sent."});
 }catch{return jsonError("Password reset is temporarily unavailable.",500);}
}
