import {redirect} from "next/navigation";
import {currentUser,currentMembership,userHasPermission} from "@/lib/auth";
import AdminShell, {type AdminNavGroup} from "@/components/admin-shell";

export const dynamic="force-dynamic";

const navigation:AdminNavGroup[]=[
  {title:"Customer management",items:[
    {label:"Enquiries",href:"/admin/enquiries",permission:"enquiries.view",icon:"↗"},
    {label:"Customers",href:"/admin/customers",permission:"customers.view",icon:"♙"},
    {label:"Vehicles",href:"/admin/vehicles",permission:"vehicles.view",icon:"▱"}
  ]},
  {title:"Bookings & workshop",items:[
    {label:"Appointments & calendar",href:"/admin/appointments",permission:"appointments.view",icon:"▦"},
    {label:"Work orders",href:"/admin/jobs",permission:"jobs.view",icon:"▤"},
    {label:"Quotes",href:"/admin/quotes",permission:"quotes.view",icon:"▧"}
  ]},
  {title:"Finance & purchasing",items:[
    {label:"Invoices & payments",href:"/admin/invoices",permission:"invoices.view",icon:"＄"},
    {label:"Suppliers",href:"/admin/suppliers",permission:"suppliers.view",icon:"▣"},
    {label:"Supplier orders",href:"/admin/supplier-orders",permission:"suppliers.view",icon:"⇢"},
    {label:"Expenses",href:"/admin/expenses",permission:"expenses.view",icon:"−"}
  ]},
  {title:"People & access",items:[
    {label:"Employees",href:"/admin/staff",permission:"staff.view",icon:"♧"},
    {label:"Roles & permissions",href:"/admin/roles",permission:"roles.manage",icon:"⌘"}
  ]},
  {title:"Business configuration",items:[
    {label:"Website editor",href:"/admin/website",permission:"website.manage",icon:"▤"},
    {label:"Services",href:"/admin/services",permission:"business.settings.manage",icon:"⚙"},
    {label:"Service areas",href:"/admin/service-areas",permission:"business.settings.manage",icon:"⌖"},
    {label:"Business profile",href:"/admin/business-profile",permission:"business.settings.manage",icon:"▧"},
    {label:"Business settings",href:"/admin/settings",permission:"settings.manage",icon:"⚙"}
  ]}
];

export default async function AdminLayout({children}:{children:React.ReactNode}) {
  const user=await currentUser();
  if(!user)redirect("/portal/sign-in");
  const membership=await currentMembership(user.id);
  if(!membership)redirect("/staff");

  const permissionKeys=[...new Set(navigation.flatMap(group=>group.items.map(item=>item.permission)))];
  const checks=await Promise.all(permissionKeys.map(permission=>userHasPermission(user.id,permission)));
  const permitted=new Set(permissionKeys.filter((_,index)=>checks[index]));
  const groups=navigation.map(group=>({...group,items:group.items.filter(item=>permitted.has(item.permission))})).filter(group=>group.items.length>0);
  const canSeeOverview=["enquiries.view","appointments.view","jobs.view","quotes.view","invoices.view","customers.view","vehicles.view"].some(permission=>permitted.has(permission));

  if(!canSeeOverview&&!groups.length)redirect("/staff");

  return <AdminShell userName={user.full_name||user.email} role={membership.role} groups={groups}>{children}</AdminShell>;
}
