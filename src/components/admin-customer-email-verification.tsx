"use client";
import {useState} from "react";
import {useRouter} from "next/navigation";
export default function AdminCustomerEmailVerification({customerId}:{customerId:string}){
 const [busy,setBusy]=useState(false),[notice,setNotice]=useState("");
 const router=useRouter();
 async function verify(){
  if(!window.confirm("Manually verify this customer's email and activate their account?"))return;
  setBusy(true);setNotice("");
  try{
   const response=await fetch("/api/admin/customers/"+customerId+"/verify-email",{method:"POST"});
   const result=await response.json();
   if(!response.ok)throw new Error(result.error??"Could not verify customer email.");
   setNotice("Email verified.");
   router.refresh();
  }catch(error){setNotice(error instanceof Error?error.message:"Could not verify customer email.");}
  finally{setBusy(false);}
 }
 return <div className="customer-email-verification-action"><button className="button button-secondary" type="button" disabled={busy} onClick={()=>void verify()}>{busy?"Verifying…":"Manually verify email"}</button>{notice&&<small role="status">{notice}</small>}</div>;
}
