import {redirect} from "next/navigation";
import Link from "next/link";
import {currentUser,currentMembership,userHasPermission} from "@/lib/auth";
import AdminServicesManager from "@/components/admin-services-manager";
export const dynamic="force-dynamic";
export default async function AdminServicesPage(){
 const user=await currentUser();if(!user)redirect("/portal/sign-in");const membership=await currentMembership(user.id);if(!membership)redirect("/staff");
 if(!(await userHasPermission(user.id,"business.settings.manage")))redirect("/admin");
 return <main className="portal-page"><header className="portal-topbar"><div className="shell portal-topbar-inner"><strong>BRANDON RV · ADMIN</strong><div className="portal-topbar-right"><span>{membership.role}</span><Link href="/admin">Operations dashboard</Link></div></div></header><AdminServicesManager/></main>;
}