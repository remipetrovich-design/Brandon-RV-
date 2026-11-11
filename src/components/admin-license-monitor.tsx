"use client";
import {useState} from "react";
type LicenseState={valid:boolean;code:string;message:string;product:string;installationId?:string;authority?:string;expiresAt?:string|null;offlineGrace?:boolean;entitlements?:Record<string,unknown>};
export default function LicenseMonitor({initialState}:{initialState:LicenseState}){
 const [state,setState]=useState(initialState),[busy,setBusy]=useState(false),[error,setError]=useState(""),[checkedAt,setCheckedAt]=useState(new Date().toISOString());
 async function recheck(){
  setBusy(true);setError("");
  try{
   const response=await fetch("/api/admin/license",{method:"POST",headers:{"content-type":"application/json"},cache:"no-store"});
   const body=await response.json();
   if(!response.ok)throw new Error(body.error||"Licence recheck failed.");
   setState(body.state);setCheckedAt(body.checkedAt||new Date().toISOString());
  }catch(e:any){setError(e.message||"Could not recheck licence.");}
  finally{setBusy(false);}
 }
 const rows=[
  ["Product",state.product],
  ["Licence status",state.code],
  ["Installation ID",state.installationId||"Not installed"],
  ["Active authority",state.authority?state.authority.toUpperCase():"Not confirmed"],
  ["Offline grace",state.offlineGrace?"Currently in use":"Not in use"],
  ["Last checked",new Date(checkedAt).toLocaleString("en-AU")]
 ];
 return <div className="license-monitor">
  <div className={"license-monitor-status "+(state.valid?"valid":"invalid")}><div><span className="eyebrow">APPLICATION LICENCE</span><h2>{state.valid?"Licence verified":"Website access restricted"}</h2><p>{state.message}</p></div><strong>{state.valid?"ACTIVE":"BLOCKED"}</strong></div>
  <div className="license-monitor-details">{rows.map(([label,value])=><div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>
  <div className="license-monitor-actions"><button type="button" onClick={recheck} disabled={busy}>{busy?"Checking License Manager…":"Recheck with License Manager"}</button><a href="/license">Open licence installation page</a></div>
  {error&&<p role="alert" className="license-monitor-error">{error}</p>}
  <p className="license-monitor-note">This screen does not display or store the licence key in the browser. A recheck bypasses the short successful-validation cache and asks the currently active License Manager authority again.</p>
  <style jsx>{`
   .license-monitor{display:grid;gap:20px}
   .license-monitor-status{display:flex;align-items:center;justify-content:space-between;gap:20px;padding:24px;border:1px solid #e0a6a6;background:#fff7f7;border-radius:14px;color:#762d2d}
   .license-monitor-status.valid{border-color:#a5d3b3;background:#f3fbf5;color:#225b35}
   .eyebrow{font-size:11px;font-weight:800;letter-spacing:.13em;opacity:.75}
   h2{font-size:23px;margin:7px 0}.license-monitor-status p{margin:0;font-size:14px;line-height:1.5}
   .license-monitor-status>strong{font-size:12px;letter-spacing:.1em}
   .license-monitor-details{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1px;background:#e5e9ed;border:1px solid #e5e9ed;border-radius:12px;overflow:hidden}
   .license-monitor-details>div{display:grid;gap:7px;background:#fff;padding:17px}
   .license-monitor-details span{font-size:12px;color:#75808b}.license-monitor-details strong{font-size:13px;overflow-wrap:anywhere;color:#24313d}
   .license-monitor-actions{display:flex;align-items:center;gap:18px;flex-wrap:wrap}
   .license-monitor-actions button{border:0;border-radius:8px;background:#1d3548;color:#fff;padding:12px 17px;font-weight:700;cursor:pointer}
   .license-monitor-actions button:disabled{opacity:.55;cursor:wait}
   .license-monitor-actions a{font-size:13px;color:#315b76;font-weight:700}
   .license-monitor-error{color:#a12828;font-size:13px}.license-monitor-note{font-size:12px;line-height:1.6;color:#707b85}
   @media(max-width:600px){.license-monitor-details{grid-template-columns:1fr}.license-monitor-status{align-items:flex-start;flex-direction:column}}
  `}</style>
 </div>;
}
