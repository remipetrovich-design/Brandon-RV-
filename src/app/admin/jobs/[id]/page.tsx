import Link from "next/link";
import {notFound,redirect} from "next/navigation";
import {currentUser,currentMembership,userHasPermission} from "@/lib/auth";
import AdminWorkcardManagement from "@/components/admin-workcard-management";
import AdminAccessDenied from "@/components/admin-access-denied";

export const dynamic="force-dynamic";

export default async function AdminWorkcardPage({params}:{params:Promise<{id:string}>}){
 const {id}=await params;
 const user=await currentUser();
 if(!user)redirect("/portal/sign-in");
 const membership=await currentMembership(user.id);
 if(!membership)redirect("/staff");
 const canView=await userHasPermission(user.id,"jobs.view");if(!canView)return <AdminAccessDenied resource="this Workcard"/>;
 const [canManage,canManageBookings]=await Promise.all([userHasPermission(user.id,"jobs.manage"),userHasPermission(user.id,"appointments.manage")]);
 return <main className="portal-page"><div className="shell portal-shell" style={{display:"block",maxWidth:1180}}>
  <p><Link className="button button-secondary" href={canManage?"/admin/jobs":"/admin/my-workcards"}>← Back to {canManage?"Workcards":"My Workcards"}</Link></p>
  <div className="portal-page-heading"><p className="eyebrow"><span className="eyebrow-line"/> BUSINESS OPERATIONS</p><h1>Workcard <em>details.</em></h1><p>Customer and vehicle information, job details, parts, supplier orders, completed work and notes.</p></div>
  <AdminWorkcardManagement jobId={id} canManage={canManage} canManageBookings={canManageBookings}/>
 </div></main>;
}
