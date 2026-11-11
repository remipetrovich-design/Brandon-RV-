"use client";
import {FormEvent,useState} from "react";
import AdminWorkcardSetupReview from "@/components/admin-workcard-setup-review";
type StaffOption={id:string;job_title:string|null;full_name:string;email:string};
type ReviewJob={status:string;work_summary:string|null;worker_signed_off_at:string|null;senior_approval_status:string;senior_approved_at:string|null;senior_approval_note:string|null};
type ReviewPhoto={id:string;file_name:string;url:string|null;customer_visible:boolean};
export default function AdminJobTools({jobId,canAssign,canManage}:{jobId:string;canAssign:boolean;canManage:boolean}){
 const [staff,setStaff]=useState<StaffOption[]>([]);
 const [assigned,setAssigned]=useState<string[]>([]);
 const [title,setTitle]=useState("");
 const [description,setDescription]=useState("");
 const [assignedStaffId,setAssignedStaffId]=useState("");
 const [dueAt,setDueAt]=useState("");
 const [notice,setNotice]=useState("");
 const [busy,setBusy]=useState(false);
 const [loaded,setLoaded]=useState(false);
 const [assignmentReady,setAssignmentReady]=useState(false);
 const [review,setReview]=useState<ReviewJob|null>(null);
 const [reviewPhotos,setReviewPhotos]=useState<ReviewPhoto[]>([]);
 const [workerSignedOffByCurrentUser,setWorkerSignedOffByCurrentUser]=useState(false);
 const [reviewNote,setReviewNote]=useState("");
 async function load(){
  try{
   const [assignResponse,reviewResponse]=await Promise.all([
    canAssign?fetch("/api/admin/jobs/"+jobId+"/assign",{cache:"no-store"}):Promise.resolve(null),
    canManage?fetch("/api/admin/jobs/"+jobId+"/approval",{cache:"no-store"}):Promise.resolve(null)
   ]);
   if(assignResponse){const d=await assignResponse.json();if(!assignResponse.ok){setNotice(d.error??"Could not load staff assignments.");return;}setStaff(d.staff??[]);setAssignmentReady(d.canAssign===true);setAssigned((d.assignments??[]).filter((x:any)=>["assigned","accepted"].includes(x.status)).map((x:any)=>x.staff_id));}
   if(reviewResponse){const d=await reviewResponse.json();if(!reviewResponse.ok){setNotice(d.error??"Could not load senior review.");return;}setReview(d.job??null);setReviewPhotos(d.attachments??[]);setWorkerSignedOffByCurrentUser(d.workerSignedOffByCurrentUser===true);}
   setLoaded(true);
  }catch{setNotice("Could not load Workcard controls.");}
 }
 function toggle(id:string){setAssigned(v=>v.includes(id)?v.filter(x=>x!==id):[...v,id]);}
 async function saveAssignments(){
  setBusy(true);setNotice("");
  try{const r=await fetch("/api/admin/jobs/"+jobId+"/assign",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({staffIds:assigned})});const d=await r.json();setNotice(r.ok?"Staff assignments saved.":d.error??"Could not assign staff.");if(r.ok)await load();}
  catch{setNotice("Could not assign staff.");}
  finally{setBusy(false);}
 }
 async function createTask(e:FormEvent<HTMLFormElement>){
  e.preventDefault();setBusy(true);setNotice("");
  try{const r=await fetch("/api/admin/jobs/"+jobId+"/tasks",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({title,description,assignedStaffId:assignedStaffId||null,dueAt:dueAt||null})});const d=await r.json();if(!r.ok){setNotice(d.error??"Could not create task.");return;}setTitle("");setDescription("");setDueAt("");setNotice("Task created and added to the employee workspace.");}
  catch{setNotice("Could not create task.");}
  finally{setBusy(false);}
 }
 async function submitReview(decision:"approved"|"changes_requested"){
  if(decision==="changes_requested"&&reviewNote.trim().length<5){setNotice("Describe the corrections required.");return;}
  setBusy(true);setNotice("");
  try{const r=await fetch("/api/admin/jobs/"+jobId+"/approval",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({decision,note:reviewNote})});const d=await r.json();if(!r.ok){setNotice(d.error??"Could not save senior review.");return;}setNotice(decision==="approved"?"Senior review approved. The final report is now available to the customer.":"Workcard returned to the worker for corrections.");setReviewNote("");await load();}
  catch{setNotice("Could not save senior review.");}
  finally{setBusy(false);}
 }
 return <details className="brv-admin-job-tools" onToggle={e=>{if(e.currentTarget.open&&!loaded)void load();}}>
  <summary>Workcard controls</summary>
  <div className="brv-admin-job-tools-content">
   {canManage&&<AdminWorkcardSetupReview jobId={jobId}/>}
   {canAssign&&assignmentReady&&<section><h3>Assigned team</h3>{staff.length?<><div className="brv-admin-job-assignees">{staff.map(s=><label key={s.id}><input type="checkbox" checked={assigned.includes(s.id)} onChange={()=>toggle(s.id)}/><span>{s.full_name||"Employee"}<small>{s.job_title||s.email}</small></span></label>)}</div><button className="button button-secondary" type="button" disabled={busy||!loaded} onClick={()=>void saveAssignments()}>Save assignments</button></>:<p className="panel-footnote">{loaded?"No active staff profiles are available.":"Open to load team controls."}</p>}</section>}
   {canAssign&&!assignmentReady&&<section><h3>Worker assignment</h3><p className="panel-footnote">A senior staff member must approve the Workcard setup before a worker can be assigned.</p></section>}
   {canManage&&review&&<section className="brv-senior-review"><span className="panel-kicker">SENIOR APPROVAL</span><h3>Review completed Workcard</h3>{review.senior_approval_status==="pending"?(workerSignedOffByCurrentUser?<p className="panel-footnote">The worker who signed off this Workcard cannot approve their own work. A different authorised senior staff member must review it.</p>:<><p>Worker sign-off: {review.worker_signed_off_at?new Date(review.worker_signed_off_at).toLocaleString("en-AU"):"Recorded"}</p>{review.work_summary&&<p>{review.work_summary}</p>}<label>Review note (required when returning)<textarea rows={2} value={reviewNote} onChange={e=>setReviewNote(e.target.value)} maxLength={2000} placeholder="Corrections required, or notes for the customer handover."/></label><div className="brv-senior-review-actions"><button className="button button-primary" type="button" disabled={busy} onClick={()=>void submitReview("approved")}>Approve Workcard</button><button className="button button-secondary" type="button" disabled={busy||reviewNote.trim().length<5} onClick={()=>void submitReview("changes_requested")}>Return for corrections</button></div></>):review.senior_approval_status==="approved"?<p className="inline-notice">Senior approval recorded {review.senior_approved_at?new Date(review.senior_approved_at).toLocaleString("en-AU"):""}.</p>:review.senior_approval_status==="legacy_approved"?<p className="panel-footnote">Legacy completed Workcard. No separate senior sign-off was recorded in the previous workflow.</p>:review.senior_approval_status==="changes_requested"?<p className="panel-footnote">Returned for corrections: {review.senior_approval_note??"See review notes."}</p>:<p className="panel-footnote">Senior review becomes available after the worker submits the Workcard.</p>}</section>}
   {canManage&&<section><div className="divider-line"/><h3>Add a job task</h3><form className="auth-form" onSubmit={createTask}><label>Task title<input value={title} onChange={e=>setTitle(e.target.value)} required minLength={3} maxLength={160}/></label><label>Instructions<textarea value={description} onChange={e=>setDescription(e.target.value)} rows={2} maxLength={3000}/></label><label>Assign to<select value={assignedStaffId} onChange={e=>setAssignedStaffId(e.target.value)}><option value="">Unassigned</option>{staff.map(s=><option key={s.id} value={s.id}>{s.full_name||"Employee"}</option>)}</select></label><label>Due date<input type="datetime-local" value={dueAt} onChange={e=>setDueAt(e.target.value)}/></label><button className="button button-primary" disabled={busy||!loaded||!title.trim()}>Create task</button></form></section>}
   {notice&&<p className="inline-notice" role="status">{notice}</p>}
  </div>
 </details>;
}
