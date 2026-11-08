"use client";
import {useEffect,useState} from "react";
type Integration={id:string;name:string;description:string;configured:boolean;urlConfigured:boolean;keyConfigured:boolean;management:string};
export default function AdminIntegrations(){
 const [items,setItems]=useState<Integration[]>([]);const [notice,setNotice]=useState("");
 useEffect(()=>{void(async()=>{try{const r=await fetch("/api/admin/integrations",{cache:"no-store"});const d=await r.json();if(r.ok)setItems(d.integrations??[]);else setNotice(d.error??"Could not load integrations.");}catch{setNotice("Could not load integrations.");}})();},[]);
 return <section className="portal-panel"><span className="panel-kicker">CONNECTED SERVICES</span><h2>Integration status</h2>{items.map(item=><article className="activity-item" key={item.id} style={{display:"block"}}><div className="portal-panel-heading"><div><h3>{item.name}</h3><p>{item.description}</p></div><strong>{item.configured?"Configured":"Needs configuration"}</strong></div><p className="panel-footnote">Service URL: {item.urlConfigured?"Set":"Missing"} · API key: {item.keyConfigured?"Set":"Missing"}</p><p>{item.management}</p></article>)}{notice&&<p className="inline-notice" role="status">{notice}</p>}</section>;
}
