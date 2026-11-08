import {redirect} from "next/navigation";
import {currentUser,currentMembership,userHasPermissions} from "@/lib/auth";
import AdminShell,{type AdminNavGroup} from "@/components/admin-shell";
export const dynamic="force-dynamic";
const navigation:AdminNavGroup[]=[
 {title:"Customer management",items:[{label:"Enquiries",href:"/admin/enquiries",permission:"enquiries.view",icon:"inbox"},{label:"Customers",href:"/admin/customers",permission:"customers.view",icon:"users"},{label:"Vehicles",href:"/admin/vehicles",permission:"vehicles.view",icon:"vehicle"}]},
 {title:"Bookings & workshop",items:[{label:"Appointments & calendar",href:"/admin/appointments",permission:"appointments.view",icon:"calendar"},{label:"Work orders",href:"/admin/jobs",permission:"jobs.view",icon:"jobs"},{label:"Quotes",href:"/admin/quotes",permission:"quotes.view",icon:"quote"}]},
 {title:"Finance & purchasing",items:[{label:"Invoices & payments",href:"/admin/invoices",permission:"invoices.view",icon:"finance"},{label:"Suppliers",href:"/admin/suppliers",permission:"suppliers.view",icon:"supplier"},{label:"Supplier orders",href:"/admin/supplier-orders",permission:"suppliers.view",icon:"supplier"},{label:"Expenses",href:"/admin/expenses",permission:"expenses.view",icon:"expense"}]},
 {title:"People & access",items:[{label:"Employees",href:"/admin/staff",permission:"staff.view",icon:"staff"},{label:"Workforce",href:"/admin/workforce",permission:"time.clock",icon:"calendar"},{label:"User roles & permissions",href:"/admin/roles",permission:"roles.manage",icon:"access"}]},
 {title:"Business configuration",items:[{label:"Website editor",href:"/admin/website",permission:"website.manage",icon:"website"},{label:"Services",href:"/admin/services",permission:"business.settings.manage",icon:"services"},{label:"Service areas",href:"/admin/service-areas",permission:"business.settings.manage",icon:"location"},{label:"Settings",href:"/admin/settings",permission:"business.settings.manage",icon:"settings"},{label:"Email templates",href:"/admin/email-templates",permission:"business.settings.manage",icon:"settings"}]}
];
export default async function AdminLayout({children}:{children:React.ReactNode}) {
 const user=await currentUser();if(!user)redirect("/portal/sign-in");
 const membership=await currentMembership(user.id);if(!membership)redirect("/portal");
 const permissionKeys=[...new Set([...navigation.flatMap(group=>group.items.map(item=>item.permission)),"jobs.complete","time.view","time.manage","time.clock","leave.view","leave.manage","payroll.view","payroll.manage","assets.view","assets.manage","onboarding.view","onboarding.manage","customers.view","vehicles.view"])];
 const permitted=await userHasPermissions(user.id,permissionKeys);
 const groups=navigation.map(group=>({...group,items:group.items.filter(item=>permitted.has(item.permission))})).filter(group=>group.items.length>0);
 const canSeeOverview=["enquiries.view","appointments.view","jobs.view","quotes.view","invoices.view","customers.view","vehicles.view"].some(permission=>permitted.has(permission));
 const employeeTools=["jobs.complete","time.view","time.manage","time.clock","leave.view","payroll.view","assets.view","onboarding.view"].some(permission=>permitted.has(permission));
 if(!canSeeOverview&&!groups.length&&!employeeTools)redirect("/portal");
 return <AdminShell userName={user.full_name||user.email} role={membership.role} groups={groups}>{children}</AdminShell>;
}
