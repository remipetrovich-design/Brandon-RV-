import {redirect} from "next/navigation";
import {currentUser,currentMembership,userHasPermission} from "@/lib/auth";
import AdminIntegrations from "@/components/admin-integrations";
export const dynamic="force-dynamic";
export default async function AdminIntegrationsPage(){
 const user=await currentUser();if(!user)redirect("/portal/sign-in");const membership=await currentMembership(user.id);if(!membership)redirect("/staff");
 if(!(await userHasPermission(user.id,"business.settings.manage")))redirect("/admin");
 return <main className="portal-page"><div className="shell portal-shell" style={{display:"block",maxWidth:1100}}><div className="portal-page-heading"><p className="eyebrow"><span className="eyebrow-line"/> BUSINESS CONFIGURATION</p><h1>Integrations.</h1><p>Manage API access, credentials, permissions, security controls and integration activity.</p></div><AdminIntegrations/></div></main>;
}
