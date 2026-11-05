import {redirect} from "next/navigation";
import {currentUser,currentMembership} from "@/lib/auth";
export const dynamic="force-dynamic";
export default async function StaffHomePage(){
 const user=await currentUser();
 if(!user)redirect("/portal/sign-in");
 const membership=await currentMembership(user.id);
 if(!membership)redirect("/portal");
 redirect("/admin");
}
