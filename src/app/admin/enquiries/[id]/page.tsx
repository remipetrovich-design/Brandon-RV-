import {notFound,redirect} from "next/navigation";
import Link from "next/link";
import {currentUser,currentMembership,database,userHasPermission} from "@/lib/auth";
import AdminEnquiryEditor from "@/components/admin-enquiry-editor";
import TicketConversation from "@/components/ticket-conversation";
export const dynamic="force-dynamic";
export default async function AdminEnquiryDetail({params}:{params:Promise<{id:string}>}){
 const user=await currentUser();if(!user)redirect("/portal/sign-in");
 const membership=await currentMembership(user.id);if(!membership||!(await userHasPermission(user.id,"enquiries.view")))redirect("/admin");
 const {id}=await params;
 const [{data:item},canManageEnquiries,canManageQuotes,canManageJobs]=await Promise.all([
  database().from("enquiries").select("id,request_number,request_type,contact_name,email,created_at,status").eq("id",id).eq("business_id",membership.business_id).maybeSingle(),
  userHasPermission(user.id,"enquiries.manage"),userHasPermission(user.id,"quotes.manage"),userHasPermission(user.id,"jobs.manage")
 ]);
 if(!item)notFound();
 return <main className="portal-page"><div className="shell portal-shell" style={{display:"block",maxWidth:1180}}>
  <div className="portal-page-heading"><p className="eyebrow"><span className="eyebrow-line"/> CUSTOMER WORKSPACE</p><h1>{item.request_number}</h1><p>{item.request_type.replaceAll("_"," ")} · {item.contact_name} · {item.email}</p><Link href="/admin/enquiries" className="text-link">← Back to all enquiries</Link></div>
  <AdminEnquiryEditor enquiryId={item.id} canManageEnquiries={canManageEnquiries} canManageQuotes={canManageQuotes} canManageJobs={canManageJobs}/>
  {["customer_enquiry","quote_request"].includes(item.request_type)?<TicketConversation ticketId={item.id} staff/>:<section className="portal-panel"><span className="panel-kicker">FOLLOW-UP</span><h2>Contact the customer directly</h2><p>General enquiries are handled by phone or email. Record call attempts and outcomes in internal notes; this record has no customer reply composer.</p></section>}
 </div></main>;
}
