import {redirect} from "next/navigation";
import {currentUser,currentMembership,userHasPermission} from "@/lib/auth";
import AdminEnquiriesManager from "@/components/admin-enquiries-manager";
export const dynamic="force-dynamic";
export default async function AdminEnquiriesPage({searchParams}:{searchParams?:Promise<{type?:string}>}){
 const user=await currentUser();if(!user)redirect("/portal/sign-in");const membership=await currentMembership(user.id);if(!membership||!(await userHasPermission(user.id,"enquiries.view")))redirect("/admin");
 const params=await searchParams;const allowed=["public_enquiry","general_enquiry","customer_enquiry","quote_request"];const initialType=allowed.includes(params?.type??"")?params!.type!:"all";
 return <main className="portal-page"><div className="shell portal-shell" style={{display:"block",maxWidth:1180}}><div className="portal-page-heading"><p className="eyebrow"><span className="eyebrow-line"/> CUSTOMER MANAGEMENT</p><h1>Enquiries & requests.</h1><p>One intake register for every customer request, contact form and internally logged enquiry.</p></div><AdminEnquiriesManager initialType={initialType}/></div></main>;
}
