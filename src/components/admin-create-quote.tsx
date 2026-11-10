"use client";
import {FormEvent,useEffect,useMemo,useState} from "react";
type Enquiry={id:string;request_number:string;request_type:string;contact_name:string;email:string;requested_service:string};
type PriorQuote={id:string;quote_number:string;enquiry_id:string|null;revision_number:number};
type QuoteLine={id:number;description:string;quantity:string;unitPrice:string};
const money=(value:number)=>new Intl.NumberFormat("en-AU",{style:"currency",currency:"AUD"}).format(value);
export default function AdminCreateQuote({initialEnquiryId=""}:{initialEnquiryId?:string}){
 const [enquiries,setEnquiries]=useState<Enquiry[]>([]);
 const [priorQuotes,setPriorQuotes]=useState<PriorQuote[]>([]);
 const [enquiryId,setEnquiryId]=useState(initialEnquiryId);
 const [supersedesQuoteId,setSupersedesQuoteId]=useState("");
 const [items,setItems]=useState<QuoteLine[]>([{id:1,description:"",quantity:"1",unitPrice:""}]);
 const [nextLineId,setNextLineId]=useState(2);
 const [taxRate,setTaxRate]=useState("0");
 const [gstStatus,setGstStatus]=useState("not_configured");
 const [configuredGstRate,setConfiguredGstRate]=useState(10);
 const [expiryDate,setExpiryDate]=useState("");
 const [notes,setNotes]=useState("");
 const [terms,setTerms]=useState("");
 const [notice,setNotice]=useState("");
 const [busy,setBusy]=useState(false);
 useEffect(()=>{void(async()=>{try{const r=await fetch("/api/admin/quotes");const d=await r.json();if(r.ok){setEnquiries(d.enquiries??[]);setPriorQuotes(d.quotes??[]);const status=d.pricing?.gst_status??"not_configured";const rate=Number(d.pricing?.gst_rate??10);setGstStatus(status);setConfiguredGstRate(rate);setTaxRate(status==="registered"?String(rate):"0");}else setNotice(d.error??"Could not load quote records.");}catch{setNotice("Could not load quote records.");}})();},[]);
 const ticketQuotes=priorQuotes.filter(q=>q.enquiry_id===enquiryId);
 const subtotal=useMemo(()=>items.reduce((sum,item)=>sum+Math.max(0,Number(item.quantity)||0)*Math.max(0,Number(item.unitPrice)||0),0),[items]);
 const tax=useMemo(()=>subtotal*(Number(taxRate)||0)/100,[subtotal,taxRate]);
 function updateLine(id:number,key:"description"|"quantity"|"unitPrice",value:string){setItems(current=>current.map(item=>item.id===id?{...item,[key]:value}:item));}
 function addLine(){if(items.length>=30)return;setItems(current=>[...current,{id:nextLineId,description:"",quantity:"1",unitPrice:""}]);setNextLineId(v=>v+1);}
 function removeLine(id:number){setItems(current=>current.length>1?current.filter(item=>item.id!==id):current);}
 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();setBusy(true);setNotice("");
  try{
   const r=await fetch("/api/admin/quotes",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({enquiryId,supersedesQuoteId:supersedesQuoteId||null,items:items.map(item=>({description:item.description,quantity:Number(item.quantity),unitPrice:Number(item.unitPrice)})),taxRate:Number(taxRate),expiryDate:expiryDate||null,notes,terms})});
   const d=await r.json();if(!r.ok){setNotice(d.error??"Could not create quote.");return;}
   setNotice("Draft quote "+d.quote.quote_number+" created with "+items.length+" line(s). Senior review is required before issue.");
   setItems([{id:1,description:"",quantity:"1",unitPrice:""}]);setNextLineId(2);setNotes("");setTerms("");setExpiryDate("");setSupersedesQuoteId("");
  }catch{setNotice("Could not create quote.");}
  finally{setBusy(false);}
 }
 return <section className="portal-panel"><span className="panel-kicker">NEW QUOTE</span><h2>Prepare a quote for a Quote Request Jobcard</h2><form className="auth-form" onSubmit={submit}>
  <label>Quote Request Jobcard<select value={enquiryId} onChange={e=>{setEnquiryId(e.target.value);setSupersedesQuoteId("");}} required><option value="">Select a quote request</option>{enquiries.map(x=><option key={x.id} value={x.id}>{x.request_number} · {x.contact_name} · {x.requested_service}</option>)}</select></label>
  {enquiryId&&ticketQuotes.length>0&&<label>Revision of (optional)<select value={supersedesQuoteId} onChange={e=>setSupersedesQuoteId(e.target.value)}><option value="">Create new quote</option>{ticketQuotes.map(q=><option key={q.id} value={q.id}>{q.quote_number} · Revision {q.revision_number}</option>)}</select></label>}
  <div className="brv-quote-lines-heading"><strong>Quote line items</strong><span>{items.length} / 30</span></div>
  <div className="brv-quote-lines">{items.map((item,index)=><div className="brv-quote-line" key={item.id}><div className="brv-quote-line-title"><strong>Line {index+1}</strong>{items.length>1&&<button type="button" className="text-link" onClick={()=>removeLine(item.id)}>Remove</button>}</div><label>Description<input value={item.description} onChange={e=>updateLine(item.id,"description",e.target.value)} required minLength={3} maxLength={500} placeholder="Labour, parts, travel, consumables…"/></label><div className="form-grid"><label>Quantity<input type="number" min="0.01" step="0.01" value={item.quantity} onChange={e=>updateLine(item.id,"quantity",e.target.value)} required/></label><label>Unit price (ex GST)<input type="number" min="0" step="0.01" value={item.unitPrice} onChange={e=>updateLine(item.id,"unitPrice",e.target.value)} required/></label></div></div>)}</div>
  <button type="button" className="button button-secondary brv-add-quote-line" disabled={items.length>=30} onClick={addLine}>+ Add line item</button>
  <div className="brv-quote-preview"><div><span>Subtotal</span><strong>{money(subtotal)}</strong></div><div><span>GST ({Number(taxRate)||0}%)</span><strong>{money(tax)}</strong></div><div className="brv-quote-preview-total"><span>Estimated total</span><strong>{money(subtotal+tax)}</strong></div></div>
  <div className="form-grid"><label>Tax rate (%)<input type="number" min="0" max="100" step="0.01" value={taxRate} readOnly={gstStatus!=="registered"} onChange={e=>setTaxRate(e.target.value)} required/><small>{gstStatus==="registered"?"Using GST rate confirmed in Business Settings ("+configuredGstRate+"%).":gstStatus==="not_registered"?"GST is disabled because the business is configured as not registered.":"GST is disabled until the accountant confirms the business registration status."}</small></label><label>Expiry date<input type="date" value={expiryDate} onChange={e=>setExpiryDate(e.target.value)}/></label></div>
  <label>Notes<textarea rows={2} value={notes} onChange={e=>setNotes(e.target.value)} maxLength={3000}/></label><label>Terms<textarea rows={2} value={terms} onChange={e=>setTerms(e.target.value)} maxLength={3000}/></label>
  <button className="button button-primary" disabled={busy||!enquiryId||items.some(item=>!item.description.trim()||!item.unitPrice)}>{busy?"Creating quote…":"Create draft quote →"}</button>
 </form>{notice&&<p className="inline-notice" role="status">{notice}</p>}</section>;
}
