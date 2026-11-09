import {notFound,redirect} from "next/navigation";
import Link from "next/link";
import {currentUser,currentMembership,database,userHasPermission} from "@/lib/auth";
import TicketConversation from "@/components/ticket-conversation";
export const dynamic="force-dynamic";
export default async function AdminEnquiryDetail({params}:{params:Promise<{id:string}>}){
 const user=await currentUser();if(!user)redirect("/portal/sign-in");const membership=await currentMembership(user.id);if(!membership||!(await userHasPermission(user.id,"enquiries.view")))redirect("/admin");
 const {id}=await params;const db=database();const {data:item}=await db.from("enquiries").select("id,request_number,request_type,contact_name,email,phone,location,vehicle_description,requested_service,description,status,created_at,user_id").eq("id",id).eq("business_id",membership.business_id).maybeSingle();
 if(!item||item.request_type==="general_enquiry")notFound();
 return <main className="portal-page"><div className="shell portal-shell" style={{display:"block",maxWidth:1100}}><div className="portal-page-heading"><p className="eyebrow"><span className="eyebrow-line"/> CUSTOMER MANAGEMENT</p><h1>{item.request_number}.</h1><p>{item.request_type.replaceAll("_"," ")} · {item.status}</p><Link href="/admin/customer-enquiries" className="text-link">← Back to customer enquiries</Link></div><section className="portal-panel"><span className="panel-kicker">REQUEST DETAILS</span><h2>{item.requested_service}</h2><p>{item.contact_name} · {item.email} · {item.phone??"No phone"}</p><p>{item.vehicle_description??"No vehicle details"} · {item.location??"Location not supplied"}</p><p>{item.description}</p><p className="panel-footnote">Received {new Date(item.created_at).toLocaleString("en-AU")}</p></section><TicketConversation ticketId={item.id} staff/></div></main>;
}