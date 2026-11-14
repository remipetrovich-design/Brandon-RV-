import {redirect} from "next/navigation";
import type {ReactNode} from "react";
import {currentUser,currentMembership,userHasPermissions} from "@/lib/auth";
import AdminShell,{type AdminNavGroup} from "@/components/admin-shell";
import "./admin-density.css";
export const dynamic="force-dynamic";

// One canonical destination per workflow. Intake sub-types are filters inside
// the Enquiries register rather than duplicate sidebar destinations.
const navigation:AdminNavGroup[]=[
 {title:"Operations",items:[
  {label:"Enquiries & requests",href:"/admin/enquiries",permission:"enquiries.view",icon:"inbox"},
  {label:"Quotes",href:"/admin/quotes",permission:"quotes.view",icon:"quote"},
  {label:"My Workcards",href:"/admin/my-workcards",permission:"jobs.view",icon:"jobs"},
  {label:"Workcard management",href:"/admin/jobs",permission:"jobs.manage",icon:"jobs"},
  {label:"Bookings & calendar",href:"/admin/appointments",permission:"appointments.view",icon:"calendar"}
 ]},
 {title:"Customers & vehicles",items:[
  {label:"Customers",href:"/admin/customers",permission:"customers.view",icon:"users"},
  {label:"Vehicles",href:"/admin/vehicles",permission:"vehicles.view",icon:"vehicle"}
 ]},
 {title:"Finance & purchasing",items:[
  {label:"Invoices & payments",href:"/admin/invoices",permission:"invoices.view",icon:"finance"},
  {label:"Expenses",href:"/admin/expenses",permission:"expenses.view",icon:"expense"},
  {label:"Suppliers",href:"/admin/suppliers",permission:"suppliers.view",icon:"supplier"},
  {label:"Supplier orders",href:"/admin/supplier-orders",permission:"suppliers.view",icon:"supplier"}
 ]},
 {title:"People & access",items:[
  {label:"Employees",href:"/admin/staff",permission:"staff.view",icon:"staff"},
  {label:"Workforce",href:"/admin/workforce",permission:"time.clock",icon:"calendar"},
  {label:"User roles & permissions",href:"/admin/roles",permission:"roles.manage",icon:"access"}
 ]},
 {title:"Business setup",items:[
  {label:"Services & scope",href:"/admin/services",permission:"business.settings.manage",icon:"services"},
  {label:"Service areas",href:"/admin/service-areas",permission:"business.settings.manage",icon:"location"},
  {label:"Website editor",href:"/admin/website",permission:"website.manage",icon:"website"},
  {label:"Email templates",href:"/admin/email-templates",permission:"business.settings.manage",icon:"settings"},
  {label:"Integrations",href:"/admin/integrations",permission:"business.settings.manage",icon:"business"},
  {label:"Settings",href:"/admin/settings",permission:"business.settings.manage",icon:"settings"},
  {label:"Application licence",href:"/admin/license",permission:"business.settings.manage",icon:"access"}
 ]}
];
export default async function AdminLayout({children}:{children:ReactNode}) {
 const user=await currentUser();if(!user)redirect("/portal/sign-in");
 const membership=await currentMembership(user.id);if(!membership)redirect("/portal");
 const permissionKeys=[...new Set([...navigation.flatMap(group=>group.items.map(item=>item.permission)),"jobs.complete","time.view","time.manage","time.clock","leave.view","leave.manage","payroll.view","payroll.manage","assets.view","assets.manage","onboarding.view","onboarding.manage","staff.manage"])];
 const permitted=await userHasPermissions(user.id,permissionKeys);
 const workforcePermissions=["time.clock","time.manage","leave.view","leave.manage","payroll.view","payroll.manage","assets.view","assets.manage","onboarding.view","onboarding.manage","staff.manage","staff.view"];
 const canAccessWorkforce=workforcePermissions.some(permission=>permitted.has(permission));
 const canAccessStaff=permitted.has("staff.view")||permitted.has("staff.manage");
 const groups=navigation.map(group=>({...group,items:group.items.filter(item=>item.href==="/admin/workforce"?canAccessWorkforce:item.href==="/admin/staff"?canAccessStaff:item.href==="/admin/my-workcards"?(permitted.has("jobs.view")||permitted.has("jobs.complete")):permitted.has(item.permission))})).filter(group=>group.items.length>0);
 const canSeeOverview=["enquiries.view","appointments.view","jobs.view","quotes.view","invoices.view","customers.view","vehicles.view"].some(permission=>permitted.has(permission));
 const employeeTools=["jobs.complete","time.view","time.manage","time.clock","leave.view","payroll.view","assets.view","onboarding.view"].some(permission=>permitted.has(permission));
 if(!canSeeOverview&&!groups.length&&!employeeTools)redirect("/portal");
 return <AdminShell userName={user.full_name||user.email} role={membership.role} groups={groups}>{children}</AdminShell>;
}
