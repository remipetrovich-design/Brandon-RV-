import {createHash} from "node:crypto";
import {database,normalizeEmail,passwordHash,digest,newToken,jsonError,sameOrigin} from "@/lib/auth";
import {isEmailConfigured,sendEmail} from "@/lib/email";
export const runtime="nodejs";
export async function POST(request:Request){
 if(!sameOrigin(request))return jsonError("Invalid request origin.",403);
 try{
  const body=await request.json();const fullName=String(body.fullName??"").trim();const email=normalizeEmail(String(body.email??""));const phone=String(body.phone??"").trim();const password=String(body.password??"");
  if(fullName.length<2||fullName.length>120)return jsonError("Enter your full name.");
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254)return jsonError("Enter a valid email address.");
  if(password.length<12||password.length>128)return jsonError("Use a password between 12 and 128 characters.");
  if(phone.length>40)return jsonError("Enter a valid phone number.");
  const db=database();const ip=request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()??"unknown";const ipHash=createHash("sha256").update(ip).digest("hex");const since=new Date(Date.now()-60*60*1000).toISOString();
  const {count}=await db.from("login_attempts").select("id",{count:"exact",head:true}).eq("attempt_type","registration").eq("email",email).eq("ip_hash",ipHash).gte("attempted_at",since);
  if((count??0)>=5)return jsonError("Too many registration attempts. Try again later.",429);
  await db.from("login_attempts").insert({attempt_type:"registration",email,ip_hash:ipHash,succeeded:true});
  const {data:existing}=await db.from("users").select("id").eq("email",email).maybeSingle();if(existing)return jsonError("An account with that email already exists.",409);
  const {data:business,error:businessError}=await db.from("businesses").select("id").eq("slug","brandon-rv").single();if(businessError||!business)return jsonError("Business setup is incomplete. Please contact Brandon RV.",503);
  const verificationEnabled=isEmailConfigured();const now=new Date().toISOString();
  const {data:user,error}=await db.from("users").insert({email,password_hash:await passwordHash(password),full_name:fullName,phone:phone||null,account_type:"customer",status:verificationEnabled?"pending":"active",email_verified_at:null}).select("id").single();
  if(error||!user)return jsonError("Could not create your account. Please try again.",500);
  const {data:customer,error:customerError}=await db.from("customers").insert({business_id:business.id,user_id:user.id,full_name:fullName,email,phone:phone||null,status:"active"}).select("id").single();
  if(customerError||!customer){await db.from("users").delete().eq("id",user.id);return jsonError("Could not finish setting up your customer profile.",500);}
  if(!verificationEnabled)return Response.json({verificationRequired:false,message:"Your customer account is ready. You can now sign in. Email verification and password recovery emails are not enabled yet; use an email address you can access."},{status:201});
  const token=newToken();const tokenHash=digest(token);const {error:tokenError}=await db.from("email_verification_tokens").insert({user_id:user.id,token_hash:tokenHash,expires_at:new Date(Date.now()+86400000).toISOString()});
  if(tokenError){await db.from("customers").delete().eq("id",customer.id);await db.from("users").delete().eq("id",user.id);return jsonError("Could not start email verification.",500);}
  const base=process.env.NEXT_PUBLIC_APP_URL??new URL(request.url).origin;const link=base+"/portal/verify-email?token="+encodeURIComponent(token);const safeName=fullName.replace(/[&<>"]/g,"");
  const sent=await sendEmail({to:email,subject:"Verify your Brandon RV account",html:"<p>Hi "+safeName+",</p><p>Confirm your email address to activate your Brandon RV customer account.</p><p><a href=\""+link+"\">Verify email address</a></p><p>This link expires in 24 hours. If you did not create this account, ignore this email.</p>"});
  if(!sent){await db.from("email_verification_tokens").delete().eq("token_hash",tokenHash);await db.from("customers").delete().eq("id",customer.id);await db.from("users").delete().eq("id",user.id);return jsonError("Email delivery failed. Please try again later or contact Brandon RV.",503);}
  return Response.json({verificationRequired:true,message:"Check your email for a verification link."},{status:201});
 }catch{return jsonError("Registration is temporarily unavailable.",500);}
}