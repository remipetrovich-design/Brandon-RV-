import {redirect} from "next/navigation";
import {currentUser,currentMembership,userHasPermissions} from "@/lib/auth";
import AdminWorkforceHub from "@/components/admin-workforce-hub";
export const dynamic="force-dynamic";
export default async function WorkforcePage(){
 const user=await currentUser();if(!user)redirect("/portal/sign-in");
 const membership=await currentMembership(user.id);if(!membership)redirect("/portal");
 const keys=["time.clock","time.manage","leave.view","leave.manage","payroll.view","payroll.manage","assets.view","assets.manage","onboarding.view","onboarding.manage","staff.manage"];
 const allowed=await userHasPermissions(user.id,keys);
 const flags={attendance:allowed.has("time.clock"),attendanceManage:allowed.has("time.manage"),leave:allowed.has("leave.view"),leaveManage:allowed.has("leave.manage"),payroll:allowed.has("payroll.view"),payrollManage:allowed.has("payroll.manage"),assets:allowed.has("assets.view"),assetsManage:allowed.has("assets.manage"),onboarding:allowed.has("onboarding.view"),onboardingManage:allowed.has("onboarding.manage"),staffManage:allowed.has("staff.manage")};
 if(!Object.values(flags).some(Boolean))redirect("/admin");
 return <div className="portal-page"><div className="shell portal-shell" style={{display:"block",maxWidth:1180}}><div className="portal-page-heading"><p className="eyebrow"><span className="eyebrow-line"/> HORILLA-INSPIRED HRMS</p><h1>Workforce <em>management.</em></h1><p>Attendance, leave, onboarding, assets and payroll preparation attached to each employee's existing customer account.</p></div><AdminWorkforceHub flags={flags}/></div></div>;
}
