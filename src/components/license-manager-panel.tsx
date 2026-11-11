"use client";
import Link from "next/link";
import {useEffect,useState} from "react";
type State={valid:boolean;code:string;message:string;product:string;authority?:string;expiresAt?:string|null;offlineGrace?:boolean};
export default function LicenseManagerPanel(){
 const [state,setState]=useState<State|null>(null),[signedIn,setSignedIn]=useState(false),[canManage,setCanManage]=useState(false),[key,setKey]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState(""),[loading,setLoading]=useState(true);
 async function refresh(){setLoading(true);try{const response=await fetch("/api/license",{cache:"no-store"});const body=await response.json();setState(body.state||null);setSignedIn(body.signedIn===true);setCanManage(body.canManage===true);}catch{setError("Could not contact Brandon RV licence status.");}finally{setLoading(false);}}
 useEffect(()=>{void refresh();},[]);
 async function install(event:React.FormEvent<HTMLFormElement>){event.preventDefault();setBusy(true);setError("");try{const response=await fetch("/api/license",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({licenseKey:key})});const body=await response.json();if(!response.ok)throw new Error(body.error||"Licence installation failed.");setKey("");setState(body.state);window.location.assign("/");}catch(e:any){setError(e.message||"Licence installation failed.");}finally{setBusy(false);}}
 return <main className="license-shell"><section className="license-card">
  <div className="license-brand"><img src="/brv-mark.webp" alt="Brandon RV"/><span>BRANDON RV</span></div>
  <p className="license-eyebrow">APPLICATION LICENSING</p><h1>Brandon RV licence</h1>
  <p className="license-intro">This application requires an active Brandon RV business licence. Your customer accounts, staff access and business records remain unchanged.</p>
  {loading?<p className="license-notice">Checking licence status…</p>:state&&<div className={state.valid?"license-status is-valid":"license-status is-invalid"}><strong>{state.valid?"Licence active":"Access restricted"}</strong><span>{state.message}</span><small>{"Product: "+state.product+" · Status: "+state.code+(state.authority?" · Authority: "+state.authority.toUpperCase():"")}</small></div>}
  {!signedIn?<div className="license-action"><p>Sign in with the Brandon RV owner account to install or replace the business licence.</p><Link className="license-button" href="/portal/sign-in">Sign in to continue</Link></div>:!canManage?<div className="license-action"><p>Your account does not have permission to manage the application licence.</p><Link href="/portal">Return to your account</Link></div>:<form onSubmit={install} className="license-form">
   <label htmlFor="license-key">Licence key</label><input id="license-key" name="licenseKey" type="password" autoComplete="off" spellCheck={false} value={key} onChange={e=>setKey(e.target.value)} placeholder="Enter the Brandon RV licence key" required maxLength={256}/>
   <button className="license-button" type="submit" disabled={busy||!key.trim()}>{busy?"Verifying licence…":state?.valid?"Replace licence":"Activate licence"}</button>
   <p className="license-hint">The key is sent directly to the License Manager for validation and stored encrypted on the server. It is never sent to the browser after installation.</p>
  </form>}
  {error&&<p className="license-error" role="alert">{error}</p>}
  <button type="button" className="license-refresh" onClick={()=>void refresh()} disabled={loading}>Refresh status</button>
  <footer>Brandon RV · Secure application licensing</footer>
 </section>
 <style jsx>{`
 .license-shell{min-height:calc(100vh - 180px);display:grid;place-items:center;padding:56px 20px;background:#f4f5f6}
 .license-card{width:min(100%,560px);background:#fff;border:1px solid #e4e7eb;border-radius:18px;padding:38px;box-shadow:0 18px 60px rgba(20,30,45,.08)}
 .license-brand{display:flex;align-items:center;gap:12px;font-weight:800;letter-spacing:.08em;font-size:13px;color:#25313d}
 .license-brand img{width:38px;height:38px;object-fit:contain}
 .license-eyebrow{margin:34px 0 8px;font-size:11px;font-weight:800;letter-spacing:.15em;color:#7c8792}
 h1{font-size:30px;line-height:1.15;margin:0;color:#17212b}
 .license-intro{font-size:14px;line-height:1.7;color:#5d6874;margin:14px 0 24px}
 .license-status{display:grid;gap:7px;padding:16px;border-radius:12px;margin:22px 0;border:1px solid #e4a6a6;background:#fff7f7;color:#762d2d}
 .license-status.is-valid{border-color:#a5d3b3;background:#f3fbf5;color:#225b35}
 .license-status span{font-size:14px;line-height:1.5}.license-status small{font-size:11px;opacity:.8}
 .license-form{display:grid;gap:11px;margin-top:24px}.license-form label{font-size:13px;font-weight:700;color:#26313b}
 .license-form input{height:48px;border:1px solid #cbd2d9;border-radius:9px;padding:0 13px;font:inherit;color:#17212b;background:#fff}
 .license-button{min-height:46px;display:inline-flex;align-items:center;justify-content:center;padding:0 18px;border:0;border-radius:9px;background:#1d3548;color:#fff;text-decoration:none;font-weight:700;font-size:14px;cursor:pointer}
 .license-button:disabled{opacity:.5;cursor:not-allowed}.license-hint,.license-action p{font-size:12px;line-height:1.6;color:#6b7580}
 .license-action{display:grid;gap:12px;margin-top:22px}.license-action a{color:#1d526f;font-weight:700}
 .license-notice{padding:14px;background:#f3f5f7;border-radius:9px;color:#53606b}.license-error{color:#a12828;font-size:13px;margin-top:14px}
 .license-refresh{margin-top:20px;padding:0;border:0;background:none;color:#476176;text-decoration:underline;cursor:pointer;font-size:12px}
 footer{margin-top:30px;padding-top:18px;border-top:1px solid #edf0f2;color:#929ba4;font-size:11px}
 @media(max-width:520px){.license-card{padding:25px 20px}.license-shell{padding:24px 12px}}
 `}</style></main>;
}