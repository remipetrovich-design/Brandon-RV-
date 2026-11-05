import { redirect } from "next/navigation";
import { currentUser,currentMembership,userHasPermission } from "@/lib/auth";
export default async function AdminLayout({children}:{children:React.ReactNode}){
 const user=await currentUser(); if(!user) redirect("/portal/sign-in");
 const membership=await currentMembership(user.id); if(!membership) redirect("/staff");
 const [staff,settings,website,customers,enquiries,jobs]=await Promise.all(["staff.view","settings.manage","website.manage","customers.view","enquiries.view","jobs.view"].map(p=>userHasPermission(user.id,p)));
 if(![staff,settings,website,customers,enquiries,jobs].some(Boolean)) redirect("/staff");
 return children;
}