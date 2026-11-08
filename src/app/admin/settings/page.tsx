import {redirect} from "next/navigation";
import {currentUser,currentMembership,userHasPermission} from "@/lib/auth";
import AdminBusinessProfile from "@/components/admin-business-profile";
import AdminGeneralSettings from "@/components/admin-general-settings";
import Link from "next/link";
export const dynamic="force-dynamic";
const links=[{title:"Website editor",description:"Edit public website pages and preview draft content.",href:"/admin/website"},{title:"Services",description:"Manage the services shown on the public website and customer enquiry forms.",href:"/admin/services"},{title:"Service areas",description:"Manage towns, suburbs, postcodes and travel fees.",href:"/admin/service-areas"},{title:"Email templates",description:"Manage automated and customer email templates.",href:"/admin/email-templates"}];
export default async function AdminSettingsPage(){
 const user=await currentUser();if(!user)redirect("/portal/sign-in");const membership=await currentMembership(user.id);if(!membership)redirect("/staff");
 if(!(await userHasPermission(user.id,"business.settings.manage")))redirect("/admin");
 return <main className="portal-page"><div className="shell portal-shell" style={{display:"block",maxWidth:1100}}><div className="portal-page-heading"><p className="eyebrow"><span className="eyebrow-line"/> BUSINESS CONFIGURATION</p><h1>Business <em>settings.</em></h1><p>Manage Brandon RV's public business details and operating preferences in one place.</p></div><AdminBusinessProfile/><div style={{height:24}}/><AdminGeneralSettings/><section className="portal-panel"><span className="panel-kicker">CONFIGURATION SHORTCUTS</span><h2>Manage other areas</h2><div className="detail-list">{links.map(item=><article className="detail-item" key={item.href}><h3>{item.title}</h3><p>{item.description}</p><Link className="text-link" href={item.href}>Open {item.title.toLowerCase()} →</Link></article>)}</div></section></div></main>;
}
