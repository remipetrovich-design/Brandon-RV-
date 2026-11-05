import { redirect } from "next/navigation";
import { currentUser, database } from "@/lib/auth";
export const dynamic = "force-dynamic";
const money = (v: number) => new Intl.NumberFormat("en-AU",{style:"currency",currency:"AUD"}).format(Number(v||0));
export default async function InvoicesPage(){
 const user=await currentUser(); if(!user) redirect("/portal/sign-in");
 const db=database();
 const {data:invoices}=await db.from("invoices").select("id,invoice_number,status,issue_date,due_date,total,amount_paid,payments(id,amount,status,paid_at)").eq("user_id",user.id).in("status",["issued","part_paid","paid","overdue"]).order("issue_date",{ascending:false});
 const rows=invoices??[];
 const outstanding=rows.reduce((n,x)=>n+Math.max(0,Number(x.total)-Number(x.amount_paid)),0);
 const paid=rows.reduce((n,x)=>n+Number(x.amount_paid||0),0);
 const overdue=rows.filter(x=>x.status==="overdue").reduce((n,x)=>n+Math.max(0,Number(x.total)-Number(x.amount_paid)),0);
 return <><div className="portal-page-heading"><p className="eyebrow"><span className="eyebrow-line"/> BILLING</p><h1>Invoices & <em>payments.</em></h1><p>Your issued invoices and recorded payment history.</p></div>
 <div className="portal-stat-grid invoice-stats"><article><span>OUTSTANDING</span><strong>{money(outstanding)}</strong><small>Balance remaining</small></article><article><span>PAID</span><strong>{money(paid)}</strong><small>Payments recorded</small></article><article><span>OVERDUE</span><strong>{money(overdue)}</strong><small>Past due balance</small></article></div>
 <section className="portal-panel"><div className="portal-panel-heading"><div><span className="panel-kicker">INVOICE HISTORY</span><h2>Your invoices</h2></div></div>
 {rows.length?<div className="activity-list">{rows.map(x=><article className="activity-item" key={x.id}><div className="activity-date">{x.invoice_number}</div><div className="activity-copy"><strong>{money(x.total)}</strong><span>{x.status.replace("_"," ")} · Issued {new Date(x.issue_date).toLocaleDateString("en-AU")}</span><small>Paid {money(x.amount_paid)} · Due {x.due_date?new Date(x.due_date).toLocaleDateString("en-AU"):"Not specified"}</small></div></article>)}</div>:<p className="panel-footnote">There are no issued invoices on your account yet.</p>}</section>
 <section className="portal-panel"><span className="panel-kicker">PAYMENT HISTORY</span><h2>Recorded payments</h2>{rows.some(x=>(x.payments??[]).length)?<div className="activity-list">{rows.flatMap(x=>(x.payments??[]).map((p:any)=><article className="activity-item" key={p.id}><div className="activity-date">{x.invoice_number}</div><div className="activity-copy"><strong>{money(p.amount)}</strong><span>{p.status} · {p.paid_at?new Date(p.paid_at).toLocaleDateString("en-AU"):"Date not recorded"}</span></div></article>))}</div>:<p className="panel-footnote">No payments have been recorded yet.</p>}</section></>;
}