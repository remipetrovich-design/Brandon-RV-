"use client";
import {FormEvent,useState} from "react";
type StaffOption={id:string;job_title:string|null;users:{full_name:string;email:string}|null};
export default function AdminJobTools({jobId}:{jobId:string}){
 const [staff,setStaff]=useState<StaffOption[]>([]);
 const [assigned,setAssigned]=useState<string[]>([]);
 const [title,setTitle]=useState("");
 const [description,setDescription]=useState("");
 const [assignedStaffId,setAssignedStaffId]=useState("");
 const [dueAt,setDueAt]=useState("");
 const [notice,setNotice]=useState("");
 const [busy,setBusy]=useState(false);
 const [loaded,setLoaded]=useState(false);
 async function load(){
  try{
   const r=await fetch("/api/admin/jobs/"+jobId+"/assign",{cache:"no-store"});
   const d=await r.json();
   if(!r.ok){setNotice(d.error??"Could not load staff assignments.");return;}
   setStaff(d.staff??[]);
   setAssigned((d.assignments??[]).filter((x:any)=>["assigned","accepted"].includes(x.status)).map((x:any)=>x.staff_id));
   setLoaded(true);
  }catch{setNotice("Could not load staff assignments.");}
 }
 function toggle(id:string){setAssigned(v=>v.includes(id)?v.filter(x=>x!==id):[...v,id]);}
 async function saveAssignments(){
  setBusy(true);setNotice("");
  try{
   const r=await fetch("/api/admin/jobs/"+jobId+"/assign",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({staffIds:assigned})});
   const d=await r.json();setNotice(r.ok?"Staff assignments saved.":d.error??"Could not assign staff.");
  }catch{setNotice("Could not assign staff.");}
  finally{setBusy(false);}
 }
 async function createTask(e:FormEvent<HTMLFormElement>){
  e.preventDefault();setBusy(true);setNotice("");
  try{
   const r=await fetch("/api/admin/jobs/"+jobId+"/tasks",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({title,description,assignedStaffId:assignedStaffId||null,dueAt:dueAt||null})});
   const d=await r.json();if(!r.ok){setNotice(d.error??"Could not create task.");return;}
   setTitle("");setDescription("");setDueAt("");setNotice("Task created and added to the employee workspace.");
  }catch{setNotice("Could not create task.");}
  finally{setBusy(false);}
 }
 return <details className="brv-admin-job-tools" onToggle={e=>{if(e.currentTarget.open&&!loaded)void load();}}>
  <summary>Team & tasks</summary>
  <div className="brv-admin-job-tools-content">
   {staff.length? <><div className="brv-admin-job-assignees">{staff.map(s=><label key={s.id}><input type="checkbox" checked={assigned.includes(s.id)} onChange={()=>toggle(s.id)}/><span>{s.users?.full_name??"Employee"}<small>{s.job_title??s.users?.email??""}</small></span></label>)}</div><button className="button button-secondary" type="button" disabled={busy||!loaded} onClick={()=>void saveAssignments()}>Save assignments</button></>:<p className="panel-footnote">{loaded?"No active staff profiles are available.":"Open to load team and task controls."}</p>}
   <div className="divider-line"/>
   <h3>Add a job task</h3>
   <form className="auth-form" onSubmit={createTask}>
    <label>Task title<input value={title} onChange={e=>setTitle(e.target.value)} required minLength={3} maxLength={160}/></label>
    <label>Instructions<textarea value={description} onChange={e=>setDescription(e.target.value)} rows={2} maxLength={3000}/></label>
    <label>Assign to<select value={assignedStaffId} onChange={e=>setAssignedStaffId(e.target.value)}><option value="">Unassigned</option>{staff.map(s=><option key={s.id} value={s.id}>{s.users?.full_name??"Employee"}</option>)}</select></label>
    <label>Due date<input type="datetime-local" value={dueAt} onChange={e=>setDueAt(e.target.value)}/></label>
    <button className="button button-primary" disabled={busy||!loaded||!title.trim()}>Create task</button>
   </form>
   {notice&&<p className="inline-notice" role="status">{notice}</p>}
  </div>
 </details>;
}
