import {currentUser,database,jsonError} from "@/lib/auth";
export async function GET(){
 const user=await currentUser();if(!user)return jsonError("Not signed in.",401);if(user.account_type!=="customer")return jsonError("Customer account required.",403);
 const db=database();const {data:customer}=await db.from("customers").select("business_id").eq("user_id",user.id).maybeSingle();if(!customer)return jsonError("Customer profile not found.",404);
 const {data,error}=await db.from("services").select("id,name").eq("business_id",customer.business_id).eq("is_active",true).eq("is_published",true).order("sort_order");
 if(error)return jsonError("Could not load services.",500);return Response.json({services:data??[]});
}