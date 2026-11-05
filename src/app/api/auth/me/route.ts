import { currentUser, jsonError } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await currentUser();
    if (!user) return jsonError("Not signed in.", 401);
    return Response.json({ user });
  } catch {
    return jsonError("Could not verify your session.", 500);
  }
}
