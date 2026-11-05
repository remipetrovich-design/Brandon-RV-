import { redirect } from "next/navigation";
import { currentUser, database } from "@/lib/auth";
import SignOutButton from "@/components/sign-out-button";

export const dynamic = "force-dynamic";

export default async function StaffHomePage() {
  const user = await currentUser();
  if (!user) redirect("/portal/sign-in");
  if (user.account_type !== "staff" && user.account_type !== "owner") redirect("/portal");
  const db = database();
  const { data: membership } = await db.from("business_members").select("business_id,role").eq("user_id", user.id).eq("is_active", true).maybeSingle();
  if (!membership) redirect("/portal/sign-in");
  const { data: staff } = await db.from("staff").select("job_title,employee_number,employment_status").eq("user_id", user.id).maybeSingle();
  return <main className="portal-page"><header className="portal-topbar"><div className="shell portal-topbar-inner"><strong>BRANDON RV · STAFF</strong><div className="portal-topbar-right"><span>{user.full_name} · {membership.role}</span><SignOutButton /></div></div></header><div className="shell portal-shell" style={{display:"block",maxWidth:900}}><div className="portal-welcome"><div><p className="eyebrow"><span className="eyebrow-line" /> STAFF WORKSPACE</p><h1>Welcome, <em>{user.full_name.split(" ")[0]}.</em></h1><p>Your Brandon RV staff account is active.</p></div></div><section className="portal-panel"><span className="panel-kicker">YOUR STAFF RECORD</span><h2>{staff?.job_title ?? membership.role}</h2><p className="panel-footnote">Account status: {user.status} · Employment status: {staff?.employment_status ?? "Not yet recorded"}</p>{staff?.employee_number && <p>Employee number: {staff.employee_number}</p>}</section><section className="portal-panel"><span className="panel-kicker">ACCESS</span><p>Your assigned role controls which business records and functions you can access. Additional staff tools will be enabled as the operations panel is built.</p></section></div></main>;
}
