import { authorizePermission,database,digest,newToken,jsonError,sameOrigin } from "@/lib/auth";
export const runtime="nodejs";
export async function POST(request:Request){
 if(!sameOrigin(request)) return jsonError("Invalid request origin.",403);
 const access=await authorizePermission("staff.manage");
 if(access.response) return access.response;
 try{
  const body=await request.json();
  const email=String(body.email??"").trim().toLowerCase();
  const fullName=String(body.fullName??"").trim();
  const role=String(body.role??"technician");
  const allowed=["administrator","manager","technician","office","accounts"];
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||fullName.length<2||fullName.length>120||!allowed.includes(role)) return jsonError("Enter a valid name, email and staff role.");
  const db=database();
  const {data:existing}=await db.from("users").select("id").eq("email",email).maybeSingle();
  if(existing) return jsonError("An account with this email already exists.",409);
  const token=newToken();
  const {error}=await db.from("user_invitations").insert({business_id:access.membership!.business_id,email,full_name:fullName,account_type:"staff",role,token_hash:digest(token),invited_by:access.user!.id,expires_at:new Date(Date.now()+7*86400000).toISOString()});
  if(error) return jsonError("Could not create staff invitation.",500);
  const base=process.env.NEXT_PUBLIC_APP_URL??new URL(request.url).origin;
  return Response.json({success:true,invitationUrl:base+"/staff/accept-invitation?token="+token,expiresInDays:7},{status:201});
 }catch{return jsonError("Could not create staff invitation.",500);}
}