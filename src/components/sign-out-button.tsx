"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function SignOutButton() {
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  async function signOut() {
    setBusy(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/portal/sign-in");
    router.refresh();
  }
  return <button className="portal-signout" type="button" onClick={signOut} disabled={busy}>{busy ? "Signing out…" : "Sign out"} <span aria-hidden="true">↗</span></button>;
}
