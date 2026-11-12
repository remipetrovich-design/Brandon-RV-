import {redirect} from "next/navigation";
import {currentUser,currentMembership,database} from "@/lib/auth";
import StaffWorkOrders from "@/components/staff-work-orders";
export const dynamic="force-dynamic";
export default async function MyWorkcardsPage(){
 const user=await currentUser();if(!user)redirect("/portal/sign-in");
 const membership=await currentMembership(user.id);if(!membership)redirect("/portal");
 const {data:staff}=await database().from("staff").select("id").eq("user_id",user.id).eq("business_id",membership.business_id).maybeSingle();
 if(!staff)redirect("/admin/jobs");
 return <main className="portal-page"><div className="shell portal-shell"><div className="portal-page-heading"><p className="eyebrow"><span className="eyebrow-line"/> WORKER PANEL</p><h1>My <em>Workcards.</em></h1><p>Your assigned jobs, approved instructions, booking requests, work records and sign-off.</p></div><StaffWorkOrders/></div></main>;
}
