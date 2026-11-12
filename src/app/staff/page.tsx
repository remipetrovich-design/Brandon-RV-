import {redirect} from "next/navigation";
import {currentUser,currentMembership,database} from "@/lib/auth";
export const dynamic="force-dynamic";
export default async function StaffHomePage(){
 const user=await currentUser();if(!user)redirect("/portal/sign-in");
 const membership=await currentMembership(user.id);if(!membership)redirect("/portal");
 const {data:staff}=await database().from("staff").select("id").eq("user_id",user.id).eq("business_id",membership.business_id).maybeSingle();
 if(!staff)redirect("/admin");
 redirect("/admin/my-workcards");
}
