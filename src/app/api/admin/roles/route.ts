import {authorizePermission,database,jsonError,sameOrigin} from "@/lib/auth";
export const runtime="nodejs";
const readKeys=(value:unknown):string[]=>Array.isArray(value)?value.map((x:unknown)=>String(x)):[];
export async function GET(){
 const access=await authorizePermission("roles.manage");if(access.response)return access.response;const db=database();
 const [{data:groups,error},{data:catalogue}]=await Promise.all([db.from("permission_groups").select("id,name,description,is_system").eq("business_id",access.membership!.business_id).order("is_system",{ascending:false}).order("name"),db.from("permissions").select("permission_key,description").order("permission_key")]);
 if(error)return jsonError("Could not load roles.",500);const ids=(groups??[]).map(g=>g.id);const {data:mappings}=ids.length?await db.from("permission_group_permissions").select("group_id,permission_key").in("group_id",ids):{data:[]};
 return Response.json({groups:(groups??[]).map(g=>({...g,permissions:(mappings??[]).filter(m=>m.group_id===g.id).map(m=>m.permission_key)})),permissions:catalogue??[]});
}
export async function POST(request:Request){
 if(!sameOrigin(request))return jsonError("Invalid request origin.",403);const access=await authorizePermission("roles.manage");if(access.response)return access.response;
 try{const body=await request.json();const name=String(body.name??"").trim();const description=String(body.description??"").trim().slice(0,500);const keys=readKeys(body.permissions);
 if(name.length<3||name.length>50||!/^[a-zA-Z0-9][a-zA-Z0-9 &_-]*$/.test(name))return jsonError("Use a role name between 3 and 50 characters.");
 const db=database();const {data:existing}=await db.from("permission_groups").select("id").eq("business_id",access.membership!.business_id).ilike("name",name).maybeSingle();if(existing)return jsonError("A role with that name already exists.",409);
 const {data:catalogue}=await db.from("permissions").select("permission_key");const allowed=new Set<string>((catalogue??[]).map(x=>String(x.permission_key)));if(keys.some((k:string)=>!allowed.has(k)))return jsonError("One or more permissions are invalid.");
 const {data:group,error}=await db.from("permission_groups").insert({business_id:access.membership!.business_id,name,description:description||null,is_system:false}).select("id,name,description,is_system").single();if(error||!group)return jsonError("Could not create role.",500);
 if(keys.length){const {error:mapError}=await db.from("permission_group_permissions").insert(keys.map((permission_key:string)=>({group_id:group.id,permission_key})));if(mapError){await db.from("permission_groups").delete().eq("id",group.id);return jsonError("Could not save role permissions.",500);}}
 return Response.json({group},{status:201});}catch{return jsonError("Could not create role.",500);}
}
export async function PATCH(request:Request){
 if(!sameOrigin(request))return jsonError("Invalid request origin.",403);const access=await authorizePermission("roles.manage");if(access.response)return access.response;
 try{const body=await request.json();const groupId=String(body.groupId??"");const keys=readKeys(body.permissions);if(!/^[0-9a-f-]{36}$/i.test(groupId))return jsonError("Invalid role.");
 const db=database();const {data:group}=await db.from("permission_groups").select("id").eq("id",groupId).eq("business_id",access.membership!.business_id).maybeSingle();if(!group)return jsonError("Role not found.",404);
 const {data:catalogue}=await db.from("permissions").select("permission_key");const allowed=new Set<string>((catalogue??[]).map(x=>String(x.permission_key)));if(keys.some((k:string)=>!allowed.has(k)))return jsonError("One or more permissions are invalid.");
 const {error:deleteError}=await db.from("permission_group_permissions").delete().eq("group_id",groupId);if(deleteError)return jsonError("Could not update role permissions.",500);
 if(keys.length){const {error}=await db.from("permission_group_permissions").insert(keys.map((permission_key:string)=>({group_id:groupId,permission_key})));if(error)return jsonError("Could not update role permissions.",500);}
 return Response.json({success:true});}catch{return jsonError("Could not update role.",500);}
}
export async function DELETE(request:Request){
 if(!sameOrigin(request))return jsonError("Invalid request origin.",403);const access=await authorizePermission("roles.manage");if(access.response)return access.response;
 try{const body=await request.json();const groupId=String(body.groupId??"");const db=database();const {data:group}=await db.from("permission_groups").select("id,name,is_system").eq("id",groupId).eq("business_id",access.membership!.business_id).maybeSingle();
 if(!group)return jsonError("Role not found.",404);if(group.is_system)return jsonError("System roles cannot be deleted.",403);
 const {count}=await db.from("business_members").select("id",{count:"exact",head:true}).eq("business_id",access.membership!.business_id).eq("role",group.name);if((count??0)>0)return jsonError("This role is assigned to staff. Reassign those staff members before deleting it.",409);
 const {error}=await db.from("permission_groups").delete().eq("id",groupId);if(error)return jsonError("Could not delete role.",500);return Response.json({success:true});}catch{return jsonError("Could not delete role.",500);}
}