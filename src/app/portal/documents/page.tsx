import {redirect} from "next/navigation";
import {currentUser,database} from "@/lib/auth";
export const dynamic="force-dynamic";
export default async function DocumentsPage(){
 const user=await currentUser();if(!user)redirect("/portal/sign-in");
 const db=database();const {data:customer}=await db.from("customers").select("id").eq("user_id",user.id).maybeSingle();
 const {data:documents}=customer?await db.from("documents").select("id,name,document_type,created_at,job_id,quote_id,invoice_id").eq("is_customer_visible",true).or("user_id.eq."+user.id+",customer_id.eq."+customer.id).order("created_at",{ascending:false}):{data:[]};
 return <><div className="portal-page-heading"><p className="eyebrow"><span className="eyebrow-line"/> YOUR DOCUMENTS</p><h1>Files & <em>paperwork.</em></h1><p>Documents Brandon RV has made available to your account.</p></div>
 <div className="document-list">{documents?.length?documents.map(d=><article className="document-row" key={d.id}><span className="document-icon">▧</span><div><strong>{d.name}</strong><small>{d.document_type.replace("_"," ").toUpperCase()} · {new Date(d.created_at).toLocaleDateString("en-AU")}</small></div><span className="document-type">PRIVATE</span><a className="text-button" href={"/api/portal/documents/"+d.id}>View file ↗</a></article>):<section className="portal-panel"><p className="panel-footnote">No customer-visible documents are available yet.</p></section>}</div><p className="portal-muted-note">Files are served through short-lived private links and are only available when your account owns the document.</p></>;
}