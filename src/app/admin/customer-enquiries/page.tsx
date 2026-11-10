import {redirect} from "next/navigation";
import {currentUser,currentMembership,userHasPermission} from "@/lib/auth";
import AdminEnquiriesManager from "@/components/admin-enquiries-manager";
export const dynamic="force-dynamic";
export default async function CustomerEnquiriesPage(){
 const user=await currentUser();if(!user)redirect("/portal/sign-in");
 const membership=await currentMembership(user.id);if(!membership||!(await userHasPermission(user.id,"enquiries.view")))redirect("/admin");
 return <main className="portal-page"><div className="shell portal-shell" style={{display:"block",maxWidth:1180}}><div className="portal-page-heading"><p className="eyebrow"><span className="eyebrow-line"/> CUSTOMER TICKETS</p><h1>Customer enquiries.</h1><p>Ongoing conversations started from the customer portal.</p></div><AdminEnquiriesManager initialType="customer_enquiry"/></div></main>;
}
