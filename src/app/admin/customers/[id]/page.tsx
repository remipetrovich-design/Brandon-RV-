import {notFound,redirect} from "next/navigation";
import {currentUser,currentMembership,userHasPermission} from "@/lib/auth";
import AdminCustomerProfile from "@/components/admin-customer-profile";
export const dynamic="force-dynamic";
export default async function CustomerProfilePage({params}:{params:Promise<{id:string}>}){
 const {id}=await params;if(!/^[0-9a-f-]{36}$/i.test(id))notFound();
 const user=await currentUser();if(!user)redirect("/portal/sign-in");
 const membership=await currentMembership(user.id);if(!membership)redirect("/portal");
 if(!(await userHasPermission(user.id,"customers.view")))redirect("/admin");
 return <AdminCustomerProfile customerId={id}/>;
}
