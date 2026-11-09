import {redirect} from "next/navigation";
import {currentUser,database} from "@/lib/auth";
import CustomerEnquiryForm from "@/components/customer-enquiry-form";
import TicketConversation from "@/components/ticket-conversation";
export const dynamic="force-dynamic";
export default async function CustomerEnquiriesPage(){
 const user=await currentUser();if(!user)redirect("/portal/sign-in");const db=database();
 const {data:enquiries}=await db.from("enquiries").select("id,request_number,requested_service,description,status,created_at,vehicle_description").eq("user_id",user.id).in("request_type",["customer_enquiry","quote_request"]).order("created_at",{ascending:false});
 return <><div className="portal-page-heading"><p className="eyebrow"><span className="eyebrow-line"/> CUSTOMER SUPPORT</p><h1>Your enquiries <em>& messages.</em></h1><p>Use this area for questions and ongoing conversations with Brandon RV. Quote requests are kept separately.</p></div><CustomerEnquiryForm/><section className="portal-panel"><span className="panel-kicker">{enquiries?.length??0} CUSTOMER ENQUIRIES</span><h2>Previous conversations</h2>{enquiries?.length?enquiries.map(item=><article className="activity-item" key={item.id}><div className="activity-copy"><strong>{item.request_number} · {item.requested_service}</strong><span>{item.status} · {new Date(item.created_at).toLocaleDateString("en-AU")}</span><p>{item.description}</p></div><TicketConversation ticketId={item.id}/></article>):<p className="panel-footnote">You have not started a customer enquiry conversation yet.</p>}</section></>;
}