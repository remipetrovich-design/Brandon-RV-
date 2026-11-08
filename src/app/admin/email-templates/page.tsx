import {redirect} from "next/navigation";
import Link from "next/link";
import {currentUser,currentMembership,userHasPermission} from "@/lib/auth";
import AdminEmailTemplates from "@/components/admin-email-templates";
export const dynamic="force-dynamic";
export default async function AdminEmailTemplatesPage(){
 const user=await currentUser();if(!user)redirect("/portal/sign-in");const membership=await currentMembership(user.id);if(!membership)redirect("/staff");
 if(!(await userHasPermission(user.id,"business.settings.manage")))redirect("/admin");
 return <main className="portal-page"><header className="portal-topbar"><div className="shell portal-topbar-inner"><strong>BRANDON RV · ADMIN</strong><div className="portal-topbar-right"><span>{membership.role}</span><Link href="/admin">Operations dashboard</Link></div></div></header><AdminEmailTemplates/></main>;
}
