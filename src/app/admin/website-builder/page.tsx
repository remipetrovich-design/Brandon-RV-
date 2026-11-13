import {redirect} from "next/navigation";
import {currentUser,currentMembership,database,userHasPermission} from "@/lib/auth";
import AdminWebsiteWorkspace from "@/components/admin-website-workspace";
export const dynamic="force-dynamic";
export default async function AdminWebsiteBuilderPage(){
 const user=await currentUser();if(!user)redirect("/portal/sign-in");
 const membership=await currentMembership(user.id);if(!membership)redirect("/staff");
 if(!(await userHasPermission(user.id,"website.manage")))redirect("/admin");
 const db=database();
 const {data,error}=await db.from("site_pages").select("id,title,slug,is_published,updated_at,content,meta_title,meta_description,draft_title,draft_content,draft_meta_title,draft_meta_description,draft_updated_at").eq("business_id",membership.business_id).order("slug",{ascending:true});
 if(error)throw new Error("Could not load website pages.");
 return <AdminWebsiteWorkspace pages={data??[]}/>;
}
