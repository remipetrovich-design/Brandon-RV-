import {redirect} from "next/navigation";
import {currentUser,currentMembership,userHasPermissions} from "@/lib/auth";
import AdminQuotesManager from "@/components/admin-quotes-manager";
export const dynamic="force-dynamic";
export default async function QuotesPage(){
 const user=await currentUser();if(!user)redirect("/portal/sign-in");
 const membership=await currentMembership(user.id);if(!membership)redirect("/portal");
 const permissions=await userHasPermissions(user.id,["quotes.view","quotes.manage","quotes.approve","jobs.manage"]);
 if(!permissions.has("quotes.view"))redirect("/admin");
 return <main className="portal-page"><div className="shell portal-shell" style={{display:"block",maxWidth:1400}}><div className="portal-page-heading"><p className="eyebrow"><span className="eyebrow-line"/> QUOTE MANAGEMENT</p><h1>Quotes.</h1><p>One register for every quote, with draft controls, revision history, approval and accepted-quote Workcard conversion.</p></div><AdminQuotesManager canManageQuotes={permissions.has("quotes.manage")} canManageJobs={permissions.has("jobs.manage")}/></div></main>;
}
