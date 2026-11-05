import { destroySession } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST() {
  try {
    await destroySession();
    return Response.json({ success: true });
  } catch {
    return Response.json({ error: "Could not end the session." }, { status: 500 });
  }
}
