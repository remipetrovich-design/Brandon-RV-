import {currentUser,jsonError,sameOrigin} from "@/lib/auth";
import {getApplicationLicenseState,installApplicationLicense,licenseErrorStatus} from "@/lib/brandon-license";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const canManage=(user:any)=>["owner","website_developer"].includes(String(user?.user_role||"").toLowerCase());

export async function GET(){
 try{
  const user=await currentUser();
  const state=await getApplicationLicenseState();
  return Response.json({state,canManage:canManage(user),signedIn:!!user});
 }catch{
  return jsonError("Could not read the application licence status.",500);
 }
}
export async function POST(request:Request){
 if(!sameOrigin(request))return jsonError("Invalid request origin.",403);
 const user=await currentUser();
 if(!user)return jsonError("Sign in with the Brandon RV owner account to install a licence.",401);
 if(!canManage(user))return jsonError("Only the Brandon RV owner or website developer can manage the application licence.",403);
 try{
  const body=await request.json();
  const state=await installApplicationLicense(String(body.licenseKey||""));
  return Response.json({success:true,state});
 }catch(error:any){
  const status=licenseErrorStatus(error);
  return Response.json({success:false,code:error?.code||"LICENSE_INSTALL_FAILED",error:error?.message||"The licence could not be installed."},{status});
 }
}
