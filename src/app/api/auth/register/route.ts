import {createHash} from "node:crypto";
import {database,normalizeEmail,passwordHash,digest,newToken,jsonError,sameOrigin} from "@/lib/auth";
import {isEmailConfigured,sendTemplateEmail} from "@/lib/email";
export const runtime="nodejs";
const isValidBirthDate=(value:string)=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;const date=new Date(value+"T00:00:00Z");return !Number.isNaN(date.getTime())&&date.toISOString().slice(0,10)===value&&date<=new Date();};
export async function POST(request:Request){
 if(!sameOrigin(request))return jsonError("Invalid request origin.",403);
 try{
  const body=await request.json();
  const suppliedFirstName=String(body.firstName??"").trim();
  const suppliedLastName=String(body.lastName??"").trim();
  const legacyName=String(body.fullName??"").trim();
  const nameParts=legacyName.split(/\s+/);
  const firstName=suppliedFirstName||nameParts[0]||"";
  const lastName=suppliedFirstName?suppliedLastName:(nameParts.slice(1).join(" ")||"");
  const fullName=[firstName,lastName].filter(Boolean).join(" ");
  const dateOfBirth=body.dateOfBirth?String(body.dateOfBirth):null;
  const email=normalizeEmail(String(body.email??""));
  const phone=String(body.phone??"").trim();
  const address=String(body.address??"").trim();
  const suburb=String(body.suburb??"").trim();
  const state=String(body.state??"").trim();
  const postcode=String(body.postcode??"").trim();
  const password=String(body.password??"");
  if(!firstName||!lastName||firstName.length>120||lastName.length>120||fullName.length<2||fullName.length>120)return jsonError("Enter a valid first and last name.");
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254)return jsonError("Enter a valid email address.");
  if(password.length<12||password.length>128)return jsonError("Use a password between 12 and 128 characters.");
  if(phone.length>40||address.length>500||suburb.length>120||state.length>80||postcode.length>12)return jsonError("One or more contact details exceed the allowed length.");
  if(dateOfBirth&&!isValidBirthDate(dateOfBirth))return jsonError("Enter a valid date of birth.");
  const db=database();
  const ip=request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()??"unknown";
  const ipHash=createHash("sha256").update(ip).digest("hex");
  const since=new Date(Date.now()-60*60*1000).toISOString();
  const {count}=await db.from("login_attempts").select("id",{count:"exact",head:true}).eq("attempt_type","registration").eq("email",email).eq("ip_hash",ipHash).gte("attempted_at",since);
  if((count??0)>=5)return jsonError("Too many registration attempts. Try again later.",429);
  await db.from("login_attempts").insert({attempt_type:"registration",email,ip_hash:ipHash,succeeded:true});
  const {data:existing}=await db.from("users").select("id").eq("email",email).maybeSingle();
  if(existing)return jsonError("An account with that email already exists.",409);
  const {data:business,error:businessError}=await db.from("businesses").select("id").eq("slug","brandon-rv").single();
  if(businessError||!business)return jsonError("Business setup is incomplete. Please contact Brandon RV.",503);
  const verificationEnabled=isEmailConfigured();
  const {data:user,error}=await db.from("users").insert({
   email,password_hash:await passwordHash(password),full_name:fullName,first_name:firstName,last_name:lastName||null,
   date_of_birth:dateOfBirth,phone:phone||null,address:address||null,suburb:suburb||null,state:state||null,postcode:postcode||null,account_type:"customer",primary_group:"customer",
   user_role:null,business_id:business.id,status:verificationEnabled?"pending":"active",email_verified_at:null
  }).select("id").single();
  if(error||!user)return jsonError("Could not create your account. Please try again.",500);
  const {data:customer,error:customerError}=await db.from("customers").insert({business_id:business.id,user_id:user.id,full_name:fullName,email,phone:phone||null,address:address||null,suburb:suburb||null,state:state||null,postcode:postcode||null,status:"active"}).select("id").single();
  if(customerError||!customer){await db.from("users").delete().eq("id",user.id);return jsonError("Could not finish setting up your customer profile.",500);}
  if(!verificationEnabled)return Response.json({verificationRequired:false,message:"Your customer account is ready. You can now sign in. Email verification and password recovery emails are not enabled yet; use an email address you can access."},{status:201});
  const token=newToken();const tokenHash=digest(token);
  const {error:tokenError}=await db.from("email_verification_tokens").insert({user_id:user.id,token_hash:tokenHash,expires_at:new Date(Date.now()+86400000).toISOString()});
  if(tokenError){await db.from("customers").delete().eq("id",customer.id);await db.from("users").delete().eq("id",user.id);return jsonError("Could not start email verification.",500);}
  const base=process.env.NEXT_PUBLIC_APP_URL??new URL(request.url).origin;
  const link=base+"/portal/verify-email?token="+encodeURIComponent(token);
  const sent=await sendTemplateEmail({key:"account_verification",to:email,name:fullName,buttonUrl:link});
  if(!sent){await db.from("email_verification_tokens").delete().eq("token_hash",tokenHash);await db.from("customers").delete().eq("id",customer.id);await db.from("users").delete().eq("id",user.id);return jsonError("Email delivery failed. Please try again later or contact Brandon RV.",503);}
  return Response.json({verificationRequired:true,message:"Check your email for a verification link."},{status:201});
 }catch{return jsonError("Registration is temporarily unavailable.",500);}
}
