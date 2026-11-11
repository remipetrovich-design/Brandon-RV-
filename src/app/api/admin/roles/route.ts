import {authorizePermission,database,jsonError,sameOrigin} from "@/lib/auth";
import {isGlobalAdministrator} from "@/lib/user-role-policy.mjs";
export const runtime="nodejs";
const readKeys=(value:unknown):string[]=>Array.isArray(value)?[...new Set(value.map((x:unknown)=>String(x)))]:[];
const roleKey=(name:string)=>name.trim().toLowerCase().replace(/[^a-z0-9]+/g,"_").replace(/^_+|_+$/g,"");
export async function GET(){
 const access=await authorizePermission("roles.manage");if(access.response)return access.response;if(!isGlobalAdministrator(access.user?.user_role))return jsonError("Only CEO / Founder or Website Development Specialist can manage role definitions.",403);const db=database();
 const [{data:roles,error},{data:catalogue}]=await Promise.all([db.from("user_roles").select("role_key,name,description,is_system").order("is_system",{ascending:false}).order("name"),db.from("permissions").select("permission_key,description").order("permission_key")]);
 if(error)return jsonError("Could not load user roles.",500);
 const keys=(roles??[]).map(x=>x.role_key);const {data:mappings}=keys.length?await db.from("user_role_permissions").select("role_key,permission_key").in("role_key",keys):{data:[]};
 return Response.json({groups:(roles??[]).map(role=>({id:role.role_key,name:role.name,description:role.description,is_system:role.is_system,permissions:isGlobalAdministrator(role.role_key)?(catalogue??[]).map(x=>x.permission_key):(mappings??[]).filter(x=>x.role_key===role.role_key).map(x=>x.permission_key)})),permissions:catalogue??[]});
}
export async function POST(request:Request){
 if(!sameOrigin(request))return jsonError("Invalid request origin.",403);const access=await authorizePermission("roles.manage");if(access.response)return access.response;if(!isGlobalAdministrator(access.user?.user_role))return jsonError("Only CEO / Founder or Website Development Specialist can manage role definitions.",403);
 try{const body=await request.json();const name=String(body.name??"").trim();const description=String(body.description??"").trim().slice(0,500);const keys=readKeys(body.permissions);const key=roleKey(name);
 if(name.length<3||name.length>50||!key)return jsonError("Use a role name between 3 and 50 characters.");
 if(["owner","website_developer","customer","ceo_founder","website_development_specialist","trial_apprentice","apprentice","senior_apprentice","team_leader","supervisor","office_admin","office_supervisor","office_manager","manager","senior_manager"].includes(key))return jsonError("This role name is reserved.");
 const db=database();const {data:catalogue}=await db.from("permissions").select("permission_key");const allowed=new Set<string>((catalogue??[]).map(x=>String(x.permission_key)));if(keys.some(k=>!allowed.has(k)))return jsonError("One or more permissions are invalid.");
 const {data:role,error}=await db.from("user_roles").insert({role_key:key,name,description:description||null,is_system:false}).select("role_key,name,description,is_system").single();if(error||!role)return jsonError("Could not create user role.",500);
 if(keys.length){const {error:mapError}=await db.rpc("set_user_role_permissions",{p_role_key:key,p_permission_keys:keys});if(mapError){await db.from("user_roles").delete().eq("role_key",key);return jsonError("Could not save role permissions.",500);}}
 return Response.json({group:{id:role.role_key,name:role.name,description:role.description,is_system:role.is_system,permissions:keys}},{status:201});
 }catch{return jsonError("Could not create user role.",500);}
}
export async function PATCH(request:Request){
 if(!sameOrigin(request))return jsonError("Invalid request origin.",403);const access=await authorizePermission("roles.manage");if(access.response)return access.response;if(!isGlobalAdministrator(access.user?.user_role))return jsonError("Only CEO / Founder or Website Development Specialist can manage role definitions.",403);
 try{const body=await request.json();const key=String(body.groupId??"");const keys=readKeys(body.permissions);if(!/^[a-z0-9_]{2,60}$/.test(key))return jsonError("Invalid user role.");
 const db=database();const {data:role}=await db.from("user_roles").select("role_key,name,is_system").eq("role_key",key).maybeSingle();if(!role)return jsonError("User role not found.",404);
 if(["owner","website_developer","ceo_founder","website_development_specialist"].includes(key))return jsonError("CEO / Founder and Website Development Specialist always retain full access.",403);
 const {data:catalogue}=await db.from("permissions").select("permission_key");const allowed=new Set<string>((catalogue??[]).map(x=>String(x.permission_key)));if(keys.some(k=>!allowed.has(k)))return jsonError("One or more permissions are invalid.");
 const {error:saveError}=await db.rpc("set_user_role_permissions",{p_role_key:key,p_permission_keys:keys});if(saveError)return jsonError("Could not update role permissions.",500);
 return Response.json({success:true});
 }catch{return jsonError("Could not update user role.",500);}
}
export async function DELETE(request:Request){
 if(!sameOrigin(request))return jsonError("Invalid request origin.",403);const access=await authorizePermission("roles.manage");if(access.response)return access.response;if(!isGlobalAdministrator(access.user?.user_role))return jsonError("Only CEO / Founder or Website Development Specialist can manage role definitions.",403);
 try{const body=await request.json();const key=String(body.groupId??"");const db=database();const {data:role}=await db.from("user_roles").select("role_key,is_system").eq("role_key",key).maybeSingle();
 if(!role)return jsonError("User role not found.",404);if(role.is_system||["owner","website_developer","customer","ceo_founder","website_development_specialist"].includes(key))return jsonError("System and reserved user roles cannot be deleted.",403);
 const {count}=await db.from("users").select("id",{count:"exact",head:true}).eq("user_role",key);if((count??0)>0)return jsonError("This role is assigned to users. Reassign those users before deleting it.",409);
 const {error}=await db.from("user_roles").delete().eq("role_key",key);if(error)return jsonError("Could not delete user role.",500);return Response.json({success:true});
 }catch{return jsonError("Could not delete user role.",500);}
}
