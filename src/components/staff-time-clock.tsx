"use client";
import {useEffect,useState} from "react";
type Entry={id:string;entry_type:string;started_at:string;job_id:string|null};
export default function TimeClock(){
 const [active,setActive]=useState<Entry|null>(null);const [notice,setNotice]=useState("");const [busy,setBusy]=useState(false);const [jobId,setJobId]=useState("");
 async function load(){try{const r=await fetch("/api/staff/time");const d=await r.json();if(r.ok)setActive(d.active);else setNotice(d.error??"Time clock unavailable.");}catch{setNotice("Time clock unavailable.");}}
 useEffect(()=>{void load();},[]);
 async function act(action:"start"|"stop"){setBusy(true);setNotice("");try{const r=await fetch("/api/staff/time",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action,jobId:jobId||null})});const d=await r.json();if(!r.ok){setNotice(d.error??"Could not update time.");return;}setNotice(action==="start"?"Time entry started.":"Time entry stopped.");await load();}catch{setNotice("Could not update time.");}finally{setBusy(false);}}
 return <section className="portal-panel"><span className="panel-kicker">TIME CLOCK</span><h2>{active?"You are clocked on":"Start a work entry"}</h2>{active?<><p>Started {new Date(active.started_at).toLocaleString("en-AU")} · {active.entry_type}</p><button className="button button-primary" disabled={busy} onClick={()=>void act("stop")}>{busy?"Saving…":"Finish time entry"}</button></>:<><label>Job reference (optional)<input value={jobId} onChange={e=>setJobId(e.target.value)} placeholder="Job ID if assigned"/></label><button className="button button-primary" disabled={busy} onClick={()=>void act("start")}>{busy?"Starting…":"Start work time"}</button></>}{notice&&<p className="inline-notice" role="status">{notice}</p>}</section>;
}