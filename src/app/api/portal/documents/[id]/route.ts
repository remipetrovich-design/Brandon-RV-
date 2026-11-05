import {currentUser,database,jsonError} from "@/lib/auth";
export const runtime="nodejs";
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
 const user=await currentUser();if(!user)return jsonError("Not signed in.",401);
 if(user.account_type!=="customer")return jsonError("Customer account required.",403);
 const {id}=await params;if(!/^[0-9a-f-]{36}$/i.test(id))return jsonError("Document not found.",404);
 const db=database();const {data:customer}=await db.from("customers").select("id").eq("user_id",user.id).maybeSingle();if(!customer)return jsonError("Customer profile not found.",404);
 const {data:document}=await db.from("documents").select("id,name,storage_path").eq("id",id).eq("is_customer_visible",true).or("user_id.eq."+user.id+",customer_id.eq."+customer.id).maybeSingle();
 if(!document)return jsonError("Document not found.",404);
 const {data,error}=await db.storage.from("brandon-rv-private").createSignedUrl(document.storage_path,60);
 if(error||!data?.signedUrl)return jsonError("Could not open this document.",500);
 return Response.redirect(data.signedUrl,302);
}