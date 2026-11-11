import {currentUser,currentMembership,database,jsonError} from "@/lib/auth";
export const runtime="nodejs";
export async function GET(){
 const user=await currentUser();if(!user)return jsonError("Not signed in.",401);
 const membership=await currentMembership(user.id);if(!membership)return jsonError("Staff access required.",403);
 const db=database();const {data:staff}=await db.from("staff").select("id").eq("user_id",user.id).eq("business_id",membership.business_id).maybeSingle();
 if(!staff)return jsonError("Employee profile not found.",404);
 const {data:assignments,error}=await db.from("job_assignments").select("id,job_id,status,assigned_at").eq("business_id",membership.business_id).eq("staff_id",staff.id).in("status",["assigned","accepted","completed"]).order("assigned_at",{ascending:false});
 if(error)return jsonError("Could not load assigned Workcards.",500);
 const ids=(assignments??[]).map(x=>x.job_id);
 const [{data:jobs, error:jobError},{data:entries,error:entryError}]=await Promise.all([
  ids.length?db.from("jobs").select("id,job_number,title,scope_of_work,status,scheduled_start,scheduled_end,actual_start,customer_visible_notes,work_summary,worker_signed_off_at,senior_approval_status,senior_approval_note,senior_approved_at,appointment_id,quote_id,customers(full_name,email,phone),quotes(quote_number,status,total)").eq("business_id",membership.business_id).in("id",ids):Promise.resolve({data:[],error:null}),
  ids.length?db.from("job_work_entries").select("id,job_id,entry_type,description,quantity,unit_price,tax_rate,line_total,occurred_at,customer_visible").in("job_id",ids).eq("business_id",membership.business_id).order("occurred_at",{ascending:false}):Promise.resolve({data:[],error:null})
 ]);
 if(jobError||entryError)return jsonError("Could not load Workcard details.",500);
 const appointmentIds=[...new Set((jobs??[]).map(x=>x.appointment_id).filter(Boolean))];
 const {data:appointments}=appointmentIds.length?await db.from("appointments").select("id,status,starts_at,ends_at,preferred_start,location,customer_notes,vehicle_id").eq("business_id",membership.business_id).in("id",appointmentIds):{data:[]};
 const appointmentById=new Map((appointments??[]).map(x=>[x.id,x]));
 const jobById=new Map((jobs??[]).map(x=>[x.id,{...x,booking:appointmentById.get(x.appointment_id)??null}]));
 const entriesByJob=new Map<string,any[]>();
 for(const entry of entries??[]){const group=entriesByJob.get(entry.job_id)??[];group.push(entry);entriesByJob.set(entry.job_id,group);}
 return Response.json({workcards:(assignments??[]).map(a=>({...a,job:jobById.get(a.job_id)??null,entries:entriesByJob.get(a.job_id)??[]})).filter(x=>x.job)});
}
