import { database,normalizeEmail,passwordHash,digest,newToken,jsonError,sameOrigin } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
export const runtime="nodejs";
export async function POST(request:Request){
 if(!sameOrigin(request)) return jsonError("Invalid request origin.",403);
 try{
  const body=await request.json();const fullName=String(body.fullName??"").trim();const email=normalizeEmail(String(body.email??""));const phone=String(body.phone??"").trim();const password=String(body.password??"");
  if(fullName.length<2||fullName.length>120) return jsonError("Enter your full name.");
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254) return jsonError("Enter a valid email address.");
  if(password.length<12||password.length>128) return jsonError("Use a password between 12 and 128 characters.");
  if(phone.length>40) return jsonError("Enter a valid phone number.");
  const db=database();const {data:existing}=await db.from("users").select("id").eq("email",email).maybeSingle();
  if(existing) return jsonError("An account with that email already exists.",409);
  const {data:business,error:businessError}=await db.from("businesses").select("id").eq("slug","brandon-rv").single();
  if(businessError||!business) return jsonError("Business setup is incomplete. Please contact Brandon RV.",503);
  const {data:user,error}=await db.from("users").insert({email,password_hash:await passwordHash(password),full_name:fullName,phone:phone||null,account_type:"customer",status:"pending",email_verified_at:null}).select("id").single();
  if(error||!user) return jsonError("Could not create your account. Please try again.",500);
  const {data:customer,error:customerError}=await db.from("customers").insert({business_id:business.id,user_id:user.id,full_name:fullName,email,phone:phone||null,status:"active"}).select("id").single();
  if(customerError||!customer){await db.from("users").delete().eq("id",user.id);return jsonError("Could not finish setting up your customer profile.",500);}
  const token=newToken();const tokenHash=digest(token);
  const {error:tokenError}=await db.from("email_verification_tokens").insert({user_id:user.id,token_hash:tokenHash,expires_at:new Date(Date.now()+86400000).toISOString()});
  if(tokenError){await db.from("customers").delete().eq("id",customer.id);await db.from("users").delete().eq("id",user.id);return jsonError("Could not start email verification.",500);}
  const base=process.env.NEXT_PUBLIC_APP_URL??new URL(request.url).origin;
  const link=base+"/portal/verify-email?token="+encodeURIComponent(token);
  const safeName=fullName.replace(/[&<>"]/g,"");
  const sent=await sendEmail({to:email,subject:"Verify your Brandon RV account",html:"<p>Hi "+safeName+",</p><p>Confirm your email address to activate your Brandon RV customer account.</p><p><a href=\""+link+"\">Verify email address</a></p><p>This link expires in 24 hours. If you did not create this account, ignore this email.</p>"});
  if(!sent){await db.from("email_verification_tokens").delete().eq("token_hash",tokenHash);await db.from("customers").delete().eq("id",customer.id);await db.from("users").delete().eq("id",user.id);return jsonError("Email delivery is not configured. Brandon RV needs to finish its email setup before accounts can be activated.",503);}
  return Response.json({verificationRequired:true,message:"Check your email for a verification link."},{status:201});
 }catch{return jsonError("Registration is temporarily unavailable.",500);}
}