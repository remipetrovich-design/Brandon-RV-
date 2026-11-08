import { database,digest,createSession,jsonError,sameOrigin } from "@/lib/auth";
import {sendTemplateEmail} from "@/lib/email";
export const runtime="nodejs";
export async function POST(request:Request){
 if(!sameOrigin(request)) return jsonError("Invalid request origin.",403);
 const form=await request.formData();const token=String(form.get("token")??"");
 if(token.length<32) return jsonError("Verification link is invalid.",400);
 const db=database();const {data:record}=await db.from("email_verification_tokens").select("id,user_id").eq("token_hash",digest(token)).is("used_at",null).gt("expires_at",new Date().toISOString()).maybeSingle();
 if(!record) return Response.redirect(new URL("/portal/sign-in?verified=expired",request.url),303);
 const {data:user}=await db.from("users").select("email,full_name").eq("id",record.user_id).maybeSingle();
 const now=new Date().toISOString();const {error}=await db.from("users").update({status:"active",email_verified_at:now,updated_at:now}).eq("id",record.user_id).eq("status","pending");
 if(error) return jsonError("Could not activate the account.",500);
 await db.from("email_verification_tokens").update({used_at:now}).eq("id",record.id);
 await db.from("email_verification_tokens").delete().eq("user_id",record.user_id).neq("id",record.id);
 await createSession(record.user_id,request);
 if(user?.email)await sendTemplateEmail({key:"welcome",to:user.email,name:user.full_name,buttonUrl:(process.env.NEXT_PUBLIC_APP_URL??new URL(request.url).origin)+"/portal"});
 return Response.redirect(new URL("/portal",request.url),303);
}