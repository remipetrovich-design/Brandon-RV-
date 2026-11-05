import { redirect } from "next/navigation";
import Link from "next/link";
import { currentUser,currentMembership,database,userHasPermission } from "@/lib/auth";
import SignOutButton from "@/components/sign-out-button";
import StaffTimeClock from "@/components/staff-time-clock";
import StaffTasks from "@/components/staff-tasks";
export const dynamic="force-dynamic";
export default async function StaffHomePage(){
 const user=await currentUser(); if(!user) redirect("/portal/sign-in");
 const membership=await currentMembership(user.id); if(!membership) redirect("/portal/sign-in");
 const db=database();
 const {data:staff}=await db.from("staff").select("id,job_title,employee_number,employment_status").eq("user_id",user.id).maybeSingle();
 const canManage=await userHasPermission(user.id,"jobs.manage");
 const canViewStaff=await userHasPermission(user.id,"staff.view");
 const canManageStaff=await userHasPermission(user.id,"staff.manage");
 const jobsQuery=canManage
  ? db.from("jobs").select("id,job_number,title,status,scheduled_start,priority").eq("business_id",membership.business_id).order("scheduled_start",{ascending:true}).limit(30)
  : staff ? db.from("job_assignments").select("status,jobs(id,job_number,title,status,scheduled_start,priority)").eq("staff_id",staff.id).in("status",["assigned","accepted"]).limit(30) : Promise.resolve({data:[],error:null});
 const [{data:jobRows},timeResult]=await Promise.all([
  jobsQuery,
  staff?db.from("time_entries").select("id,entry_type,started_at,ended_at,duration_minutes,notes").eq("staff_id",staff.id).order("started_at",{ascending:false}).limit(8):Promise.resolve({data:[],error:null})
 ]);
 const jobs=canManage?(jobRows??[]):(jobRows??[]).map((x:any)=>x.jobs).filter(Boolean);
 return <main className="portal-page"><header className="portal-topbar"><div className="shell portal-topbar-inner"><strong>BRANDON RV · STAFF</strong><div className="portal-topbar-right"><span>{user.full_name} · {membership.role}</span><SignOutButton/></div></div></header>
 <div className="shell portal-shell" style={{display:"block",maxWidth:1100}}><div className="portal-welcome"><div><p className="eyebrow"><span className="eyebrow-line"/> EMPLOYEE WORKSPACE</p><h1>Welcome, <em>{user.full_name.split(" ")[0]}.</em></h1><p>{staff?.job_title??membership.role} · {staff?.employment_status??"Active account"}</p></div></div>
 <div className="portal-shortcuts">{canManage&&<Link href="/admin"><span>▦</span><strong>Operations dashboard</strong><small>Business overview and work queue</small><b>→</b></Link>}{canManageStaff&&<Link href="/admin/staff"><span>＋</span><strong>Staff management</strong><small>Invite staff and manage access</small><b>→</b></Link>}{canViewStaff&&<Link href="/admin"><span>◷</span><strong>Team operations</strong><small>Staff and scheduling overview</small><b>→</b></Link>}</div>
 <section className="portal-panel"><div className="portal-panel-heading"><div><span className="panel-kicker">YOUR WORK</span><h2>{canManage?"Business job queue":"Assigned jobs"}</h2></div></div>{jobs.length?<div className="activity-list">{jobs.map((j:any)=><article className="activity-item" key={j.id}><div className="activity-date">{j.job_number}</div><div className="activity-copy"><strong>{j.title}</strong><span>{j.status.replace("_"," ")} · {j.priority??"normal"} priority</span><small>{j.scheduled_start?new Date(j.scheduled_start).toLocaleString("en-AU"):"Not scheduled"}</small></div></article>)}</div>:<p className="panel-footnote">No jobs are currently assigned to you.</p>}</section>
 <StaffTasks/><StaffTimeClock/><section className="portal-panel"><span className="panel-kicker">TIME RECORDS</span><h2>Recent time entries</h2>{timeResult.data?.length?<div className="activity-list">{timeResult.data.map((t:any)=><article className="activity-item" key={t.id}><div className="activity-date">{t.entry_type}</div><div className="activity-copy"><strong>{new Date(t.started_at).toLocaleString("en-AU")}</strong><span>{t.ended_at?"Ended "+new Date(t.ended_at).toLocaleString("en-AU"):"In progress"} · {t.duration_minutes??"—"} minutes</span></div></article>)}</div>:<p className="panel-footnote">No time entries recorded yet.</p>}</section>
 </div></main>;
}