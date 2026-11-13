"use client";

import {useEffect,useState} from "react";
import GeneralEnquiryForm from "@/components/general-enquiry-form";

type Profile={full_name?:string|null;email?:string|null;phone?:string|null;account_type?:string|null};
export default function WebsiteGeneralEnquiryBlock(){
 const [profile,setProfile]=useState<Profile|null>(null);
 useEffect(()=>{let active=true;void fetch("/api/portal/profile",{cache:"no-store"}).then(async response=>response.ok?response.json():null).then(data=>{if(active)setProfile(data?.profile??null);}).catch(()=>{});return()=>{active=false;};},[]);
 return <GeneralEnquiryForm initialName={profile?.full_name??""} initialEmail={profile?.email??""} initialPhone={profile?.phone??""} isLoggedIn={profile?.account_type==="customer"}/>;
}
