"use client";
import {usePathname,useRouter} from "next/navigation";
import {ReactNode,useEffect,useState} from "react";

const publicPages=["/portal/sign-in","/portal/register","/portal/verify-email","/portal/forgot-password","/portal/reset-password"];

export default function PortalAuthGuard({children}:{children:ReactNode}){
 const pathname=usePathname();
 const router=useRouter();
 const isPublic=publicPages.includes(pathname);
 const [readyPath,setReadyPath]=useState("");

 useEffect(()=>{
  let active=true;
  fetch("/api/auth/me",{cache:"no-store"}).then(async response=>{
   if(!active)return;
   if(response.ok){
    setReadyPath(pathname);
   }else if(isPublic){
    setReadyPath(pathname);
   }else{
    router.replace("/portal/sign-in");
   }
  }).catch(()=>{
   if(!active)return;
   if(isPublic)setReadyPath(pathname);
   else router.replace("/portal/sign-in");
  });
  return()=>{active=false;};
 },[isPublic,pathname,router]);

 if(readyPath!==pathname)return <div className="auth-wrap" role="status">Checking your account…</div>;
 return <>{children}</>;
}
