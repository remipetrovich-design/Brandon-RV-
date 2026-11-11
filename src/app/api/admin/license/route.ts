import {currentUser,jsonError,sameOrigin,userHasPermission} from "@/lib/auth";
import {getApplicationLicenseState} from "@/lib/brandon-license";
export const runtime="nodejs";
export const dynamic="force-dynamic";
async function requireAdmin(){
 const user=await currentUser();
 if(!user)return {user:null,response:jsonError("Not signed in.",401)};
 if(!(await userHasPermission(user.id,"business.settings.manage")))return {user:null,response:jsonError("You do not have permission to monitor application licensing.",403)};
 return {user,response:null};
}
export async function GET(){
 const auth=await requireAdmin();if(auth.response)return auth.response;
 const state=await getApplicationLicenseState();
 return Response.json({state,checkedAt:new Date().toISOString()},{headers:{"cache-control":"no-store"}});
}
export async function POST(request:Request){
 if(!sameOrigin(request))return jsonError("Invalid request origin.",403);
 const auth=await requireAdmin();if(auth.response)return auth.response;
 const state=await getApplicationLicenseState({forceRecheck:true});
 return Response.json({state,checkedAt:new Date().toISOString()},{headers:{"cache-control":"no-store"}});
}
