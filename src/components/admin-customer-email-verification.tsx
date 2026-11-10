"use client";
import {useState} from "react";
import {useRouter} from "next/navigation";
export default function AdminCustomerEmailVerification({customerId}:{customerId:string}){
 const [busy,setBusy]=useState(false);
 const [notice,setNotice]=useState<{type:"success"|"error";text:string}|null>(null);
 const router=useRouter();
 async function verify(){
  setBusy(true);setNotice(null);
  try{
   const response=await fetch("/api/admin/customers/"+customerId+"/verify-email",{method:"POST"});
   const result=await response.json();
   if(!response.ok)throw new Error(result.error??"Could not verify customer email.");
   setNotice({type:"success",text:"Email verified successfully. Account moved to Customers."});
   router.refresh();
  }catch(error){
   setNotice({type:"error",text:error instanceof Error?error.message:"Could not verify customer email."});
  }finally{setBusy(false);}
 }
 return <div className="customer-email-verification-action"><button className="button button-secondary" type="button" disabled={busy} onClick={()=>void verify()}>{busy?"Verifying…":"Verify email"}</button>{notice&&<div className={"form-banner "+(notice.type==="success"?"form-banner-success":"form-banner-error")} role={notice.type==="success"?"status":"alert"}>{notice.text}</div>}</div>;
}
