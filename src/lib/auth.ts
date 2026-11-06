import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import argon2 from "argon2";
import {hasEmployeeAccess,isGlobalAdministrator} from "@/lib/user-role-policy.mjs";
const SESSION_COOKIE="brandon_rv_session";
const SESSION_DAYS=14;
export function database(){const url=process.env.SUPABASE_URL;const key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!url||!key)throw new Error("Server database environment is not configured.");return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});}
export const digest=(value:string)=>createHash("sha256").update(value).digest("hex");
export const newToken=()=>randomBytes(32).toString("base64url");
export const normalizeEmail=(value:string)=>value.trim().toLowerCase();
export function sameOrigin(request:Request){const origin=request.headers.get("origin");if(!origin)return request.headers.get("sec-fetch-site")!=="cross-site";try{return new URL(origin).origin===new URL(request.url).origin;}catch{return false;}}
export async function createSession(userId:string,request?:Request){const db=database();const token=newToken();const expiresAt=new Date(Date.now()+SESSION_DAYS*86400000).toISOString();const agent=request?.headers.get("user-agent")?.slice(0,500)??null;const ip=request?.headers.get("x-forwarded-for")?.split(",")[0]?.trim()??"";const ipHash=ip?digest(ip):null;const {error}=await db.from("user_sessions").insert({user_id:userId,token_hash:digest(token),expires_at:expiresAt,user_agent:agent,ip_hash:ipHash});if(error)throw error;const jar=await cookies();jar.set(SESSION_COOKIE,token,{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"lax",path:"/",expires:new Date(expiresAt)});}
export async function currentUser(){
 const jar=await cookies();const token=jar.get(SESSION_COOKIE)?.value;if(!token)return null;
 const db=database();const {data:session}=await db.from("user_sessions").select("id,user_id,expires_at").eq("token_hash",digest(token)).gt("expires_at",new Date().toISOString()).maybeSingle();if(!session)return null;
 const {data:user}=await db.from("users").select("id,email,full_name,first_name,last_name,date_of_birth,phone,account_type,status,email_verified_at,force_password_change,primary_group,business_id,user_role,employee_number,job_title,employment_type,employment_status,start_date,end_date,pay_rate,pay_frequency,payroll_reference,payroll_notes,emergency_contact_name,emergency_contact_phone,employee_internal_notes").eq("id",session.user_id).eq("status","active").maybeSingle();
 if(!user)return null;return {...user,account_type:"customer",primary_group:"customer"};
}
export async function currentMembership(userId:string){
 const db=database();const {data:user}=await db.from("users").select("id,business_id,user_role,employment_status,status").eq("id",userId).eq("status","active").maybeSingle();
 if(!user?.user_role||!user.business_id)return null;
 if(!hasEmployeeAccess(user))return null;
 const {data:role}=await db.from("user_roles").select("name").eq("role_key",user.user_role).maybeSingle();
 return {id:user.id,business_id:user.business_id,role:role?.name??user.user_role,is_active:true};
}
export async function userHasPermissions(userId:string,permissions:string[]){
 const requested=[...new Set(permissions)];if(!requested.length)return new Set<string>();
 const db=database();const {data:user}=await db.from("users").select("user_role,employment_status,status").eq("id",userId).eq("status","active").maybeSingle();
 if(!user?.user_role)return new Set<string>();
 const role=String(user.user_role).toLowerCase();
 if(isGlobalAdministrator(role))return new Set(requested);
 if(!hasEmployeeAccess(user))return new Set<string>();
 const {data}=await db.from("user_role_permissions").select("permission_key").eq("role_key",user.user_role).in("permission_key",requested);
 return new Set((data??[]).map((x:{permission_key:string})=>x.permission_key));
}
export async function userHasPermission(userId:string,permission:string){return (await userHasPermissions(userId,[permission])).has(permission);}
export async function authorizePermission(permission:string){
 const user=await currentUser();if(!user)return {user:null,membership:null,response:jsonError("Not signed in.",401)};
 const membership=await currentMembership(user.id);if(!membership||!(await userHasPermission(user.id,permission)))return {user,membership,response:jsonError("You do not have permission to perform this action.",403)};
 return {user,membership,response:null};
}
export async function destroySession(){const jar=await cookies();const token=jar.get(SESSION_COOKIE)?.value;if(token){const db=database();await db.from("user_sessions").delete().eq("token_hash",digest(token));}jar.delete(SESSION_COOKIE);}
export async function passwordHash(password:string){return argon2.hash(password,{type:argon2.argon2id,memoryCost:19456,timeCost:2,parallelism:1});}
export async function passwordMatches(password:string,storedHash:string|null){if(!storedHash)return false;try{return await argon2.verify(storedHash,password);}catch{return false;}}
export function jsonError(message:string,status=400){return Response.json({error:message},{status});}
