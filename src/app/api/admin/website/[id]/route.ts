import {revalidateTag} from "next/cache";
import {currentUser,currentMembership,database,userHasPermission,jsonError,sameOrigin} from "@/lib/auth";

export const runtime="nodejs";

const clean=(value:unknown,max:number)=>String(value??"").trim().slice(0,max);

export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}){
 if(!sameOrigin(request))return jsonError("Invalid request origin.",403);
 const user=await currentUser();
 if(!user)return jsonError("Not signed in.",401);
 const membership=await currentMembership(user.id);
 if(!membership)return jsonError("Business access required.",403);
 if(!(await userHasPermission(user.id,"website.manage")))return jsonError("You do not have permission to edit website content.",403);

 const {id}=await params;
 if(!/^[0-9a-f-]{36}$/i.test(id))return jsonError("Website page not found.",404);

 try{
  const body=await request.json();
  const update:Record<string,unknown>={};
  if(body.title!==undefined){
   const title=clean(body.title,160);
   if(title.length<1)return jsonError("Enter a page title.");
   update.title=title;
  }
  if(body.content!==undefined){
   if(!body.content||typeof body.content!=="object"||Array.isArray(body.content))return jsonError("Page content must be a JSON object.");
   const serialized=JSON.stringify(body.content);
   if(serialized.length>100000)return jsonError("Page content must be under 100 KB.");
   update.content=body.content;
  }
  if(body.meta_title!==undefined)update.meta_title=clean(body.meta_title,160)||null;
  if(body.meta_description!==undefined)update.meta_description=clean(body.meta_description,320)||null;
  if(!Object.keys(update).length)return jsonError("No page changes supplied.");

  const db=database();
  const {data:page,error}=await db.from("site_pages").update({...update,updated_at:new Date().toISOString()})
   .eq("id",id).eq("business_id",membership.business_id)
   .select("id,title,slug,content,meta_title,meta_description,is_published,updated_at").maybeSingle();
  if(error)return jsonError("Could not save website page.",500);
  if(!page)return jsonError("Website page not found.",404);

  await db.from("audit_events").insert({
   business_id:membership.business_id,actor_user_id:user.id,action:"website.page.updated",
   entity_type:"site_page",entity_id:id,details:{fields:Object.keys(update)}
  });
  revalidateTag("brv-public-site","max");
  return Response.json({page});
 }catch{
  return jsonError("Could not save website page.");
 }
}
