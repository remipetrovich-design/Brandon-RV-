import {authorizePermission} from "@/lib/auth";
export const runtime="nodejs";
export async function GET(){
 const access=await authorizePermission("business.settings.manage");if(access.response)return access.response;
 return Response.json({integrations:[{id:"orbitfs-mail",name:"OrbitFS Mail System",description:"Existing transactional email service used by Brandon RV email templates.",configured:Boolean(process.env.ORBITFS_MAIL_URL&&process.env.BRANDONSRV_MAIL_API_KEY),urlConfigured:Boolean(process.env.ORBITFS_MAIL_URL),keyConfigured:Boolean(process.env.BRANDONSRV_MAIL_API_KEY),management:"Email sender selection and templates are managed under Email Templates."}]});
}
