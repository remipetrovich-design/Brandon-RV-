"use client";

import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";

export default function PortalAuthGuard({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isPublic = pathname === "/portal/sign-in" || pathname === "/portal/register";
  const [ready, setReady] = useState(isPublic);
  useEffect(() => {
    if (isPublic) { setReady(true); return; }
    let active = true;
    fetch("/api/auth/me", { cache: "no-store" }).then(response => {
      if (!active) return;
      if (!response.ok) router.replace("/portal/sign-in");
      else setReady(true);
    }).catch(() => { if (active) router.replace("/portal/sign-in"); });
    return () => { active = false; };
  }, [isPublic, pathname, router]);
  if (!ready) return <div className="auth-wrap" role="status">Checking your account…</div>;
  return <>{children}</>;
}
