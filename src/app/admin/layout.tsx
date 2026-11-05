import {redirect} from "next/navigation";
import {currentUser,currentMembership,userHasPermission} from "@/lib/auth";
import AdminShell, {type AdminNavGroup} from "@/components/admin-shell";
export const dynamic="force-dynamic";
const navigation:AdminNavGroup[]=[
 {title:"Customer management",items:[{label:"Enquiries",href:"/admin/enquiries",permission:"enquiries.view",icon:"inbox"},{label:"Customers",href:"/admin/customers",permission:"customers.view",icon:"users"},{label:"Vehicles",href:"/admin/vehicles",permission:"vehicles.view",icon:"vehicle"}]},
 {title:"Bookings & workshop",items:[{label:"Appointments & calendar",href:"/admin/appointments",permission:"appointments.view",icon:"calendar"},{label:"Work orders",href:"/admin/jobs",permission:"jobs.view",icon:"jobs"},{label:"Quotes",href:"/admin/quotes",permission:"quotes.view",icon:"quote"}]},
 {title:"Finance & purchasing",items:[{label:"Invoices & payments",href:"/admin/invoices",permission:"invoices.view",icon:"finance"},{label:"Suppliers",href:"/admin/suppliers",permission:"suppliers.view",icon:"supplier"},{label:"Supplier orders",href:"/admin/supplier-orders",permission:"suppliers.view",icon:"supplier"},{label:"Expenses",href:"/admin/expenses",permission:"expenses.view",icon:"expense"}]},
 {title:"People & access",items:[{label:"Employees",href:"/admin/staff",permission:"staff.view",icon:"staff"},{label:"Roles & permissions",href:"/admin/roles",permission:"roles.manage",icon:"access"}]},
 {title:"Business configuration",items:[{label:"Website editor",href:"/admin/website",permission:"website.manage",icon:"jobs"},{label:"Services",href:"/admin/services",permission:"business.settings.manage",icon:"services"},{label:"Service areas",href:"/admin/service-areas",permission:"business.settings.manage",icon:"location"},{label:"Business profile",href:"/admin/business-profile",permission:"business.settings.manage",icon:"quote"},{label:"Business settings",href:"/admin/settings",permission:"settings.manage",icon:"services"}]}
];
export default async function AdminLayout({children}:{children:React.ReactNode}) {
 const user=await currentUser();if(!user)redirect("/portal/sign-in");
 const membership=await currentMembership(user.id);if(!membership)redirect("/portal");
 const permissionKeys=[...new Set(navigation.flatMap(group=>group.items.map(item=>item.permission)))];
 const checks=await Promise.all(permissionKeys.map(permission=>userHasPermission(user.id,permission)));
 const permitted=new Set(permissionKeys.filter((_,index)=>checks[index]));
 const groups=navigation.map(group=>({...group,items:group.items.filter(item=>permitted.has(item.permission))})).filter(group=>group.items.length>0);
 const canSeeOverview=["enquiries.view","appointments.view","jobs.view","quotes.view","invoices.view","customers.view","vehicles.view"].some(permission=>permitted.has(permission));
 if(!canSeeOverview&&!groups.length)redirect("/portal");
 return <AdminShell userName={user.full_name||user.email} role={membership.role} groups={groups}>{children}</AdminShell>;
}
