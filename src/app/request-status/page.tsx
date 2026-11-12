import GuestRequestWorkspace from "@/components/guest-request-workspace";
export const dynamic="force-dynamic";
export default async function RequestStatusPage({searchParams}:{searchParams:Promise<{ticket?:string;token?:string}>}){
 const params=await searchParams;const ticket=params.ticket??"";const token=params.token??"";
 if(!/^[0-9a-f-]{36}$/i.test(ticket)||token.length<20)return <main className="content-section"><div className="shell"><h1>Request access details required.</h1><p>Open the secure link provided when your Request Quote was submitted. You need both the Request Quote ID and guest access code.</p></div></main>;
 return <main className="portal-page"><div className="shell portal-shell" style={{display:"block",maxWidth:1000}}><div className="portal-page-heading"><p className="eyebrow"><span className="eyebrow-line"/> GUEST QUOTE PORTAL</p><h1>Your <em>quote request.</em></h1><p>Review and respond to quotes, or message Brandon RV about your enquiry.</p></div><GuestRequestWorkspace ticketId={ticket} token={token}/></div></main>;
}