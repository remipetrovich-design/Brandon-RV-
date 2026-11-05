import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import argon2 from "argon2";

const SESSION_COOKIE = "brandon_rv_session";
const SESSION_DAYS = 14;

export function database() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Server database environment is not configured.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}

export const digest = (value: string) => createHash("sha256").update(value).digest("hex");
export const newToken = () => randomBytes(32).toString("base64url");
export const normalizeEmail = (value: string) => value.trim().toLowerCase();

export async function createSession(userId: string, request?: Request) {
  const db = database();
  const token = newToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400000).toISOString();
  const agent = request?.headers.get("user-agent")?.slice(0, 500) ?? null;
  const { error } = await db.from("user_sessions").insert({ user_id: userId, token_hash: digest(token), expires_at: expiresAt, user_agent: agent });
  if (error) throw error;
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", expires: new Date(expiresAt) });
}

export async function currentUser() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const db = database();
  const { data: session } = await db.from("user_sessions").select("id,user_id,expires_at").eq("token_hash", digest(token)).gt("expires_at", new Date().toISOString()).maybeSingle();
  if (!session) return null;
  const { data: user } = await db.from("users").select("id,email,full_name,phone,account_type,status,email_verified_at,force_password_change").eq("id", session.user_id).eq("status", "active").maybeSingle();
  if (!user) return null;
  return user;
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    const db = database();
    await db.from("user_sessions").delete().eq("token_hash", digest(token));
  }
  jar.delete(SESSION_COOKIE);
}

export async function passwordHash(password: string) {
  return argon2.hash(password, { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 });
}

export async function passwordMatches(password: string, storedHash: string) {
  try { return await argon2.verify(storedHash, password); } catch { return false; }
}

export function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}
