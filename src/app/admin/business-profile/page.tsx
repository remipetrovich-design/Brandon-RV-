import {redirect} from "next/navigation";
import Link from "next/link";
import {currentUser,currentMembership,userHasPermission} from "@/lib/auth";
import AdminBusinessProfile from "@/components/admin-business-profile";
export const dynamic="force-dynamic";
export default async function AdminBusinessProfilePage(){
 const user=await currentUser();if(!user)redirect("/portal/sign-in");const membership=await currentMembership(user.id);if(!membership)redirect("/staff");
 if(!(await userHasPermission(user.id,"business.settings.manage")))redirect("/admin");
 return <main className="portal-page"><header className="portal-topbar"><div className="shell portal-topbar-inner"><strong>BRANDON RV · ADMIN</strong><div className="portal-topbar-right"><span>{membership.role}</span><Link href="/admin">Operations dashboard</Link></div></div></header><div className="shell portal-shell" style={{display:"block",maxWidth:1100}}><div className="portal-page-heading"><p className="eyebrow"><span className="eyebrow-line"/> BUSINESS CONFIGURATION</p><h1>Business <em>profile.</em></h1><p>Manage the business details shown on the public website.</p></div><AdminBusinessProfile/></div></main>;
}