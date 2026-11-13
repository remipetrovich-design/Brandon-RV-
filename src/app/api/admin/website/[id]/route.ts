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
  const db=database();

  if(body.is_published!==undefined){
   if(typeof body.is_published!=="boolean")return jsonError("Invalid publication setting.");
   if(Object.keys(body).some(key=>key!=="is_published"))return jsonError("Save draft changes before publishing the page.");
   const {data:current,error:readError}=await db.from("site_pages")
    .select("id,draft_title,draft_content,draft_meta_title,draft_meta_description")
    .eq("id",id).eq("business_id",membership.business_id).maybeSingle();
   if(readError)return jsonError("Could not load website page.",500);
   if(!current)return jsonError("Website page not found.",404);

   const publish=body.is_published===true;
   const update:Record<string,unknown>={is_published:publish,published_at:publish?new Date().toISOString():null,updated_at:new Date().toISOString()};
   if(publish&&current.draft_content!==null){
    update.title=current.draft_title;
    update.content=current.draft_content;
    update.meta_title=current.draft_meta_title;
    update.meta_description=current.draft_meta_description;
   }
   const {data:page,error}=await db.from("site_pages").update(update).eq("id",id).eq("business_id",membership.business_id)
    .select("id,title,slug,content,meta_title,meta_description,is_published,updated_at").maybeSingle();
   if(error||!page)return jsonError("Could not publish website page.",500);
   await db.from("audit_events").insert({business_id:membership.business_id,actor_user_id:user.id,action:publish?"website.page.published":"website.page.unpublished",entity_type:"site_page",entity_id:id,details:{published:publish}});
   revalidateTag("brv-public-site","max");
   return Response.json({page});
  }

  const draft:Record<string,unknown>={draft_updated_at:new Date().toISOString()};
  if(body.title!==undefined){
   const title=clean(body.title,160);
   if(title.length<1)return jsonError("Enter a page title.");
   draft.draft_title=title;
  }
  if(body.content!==undefined){
   if(!body.content||typeof body.content!=="object"||Array.isArray(body.content))return jsonError("Page content must be a JSON object.");
   if(JSON.stringify(body.content).length>100000)return jsonError("Page content must be under 100 KB.");
   draft.draft_content=body.content;
  }
  if(body.meta_title!==undefined)draft.draft_meta_title=clean(body.meta_title,160)||null;
  if(body.meta_description!==undefined)draft.draft_meta_description=clean(body.meta_description,320)||null;
  if(Object.keys(draft).length===1)return jsonError("No page changes supplied.");

  const {data:page,error}=await db.from("site_pages").update(draft).eq("id",id).eq("business_id",membership.business_id)
   .select("id,title,slug,draft_title,draft_content,draft_meta_title,draft_meta_description,draft_updated_at,is_published").maybeSingle();
  if(error)return jsonError("Could not save website draft.",500);
  if(!page)return jsonError("Website page not found.",404);
  await db.from("audit_events").insert({business_id:membership.business_id,actor_user_id:user.id,action:"website.page.draft_saved",entity_type:"site_page",entity_id:id,details:{fields:Object.keys(draft).filter(key=>key!=="draft_updated_at")}});
  return Response.json({page});
 }catch{
  return jsonError("Could not save website page.");
 }
}
