import type {Metadata} from "next";
import LicenseManagerPanel from "@/components/license-manager-panel";
export const metadata:Metadata={title:"Application licence"};
export const dynamic="force-dynamic";
export default function LicensePage(){return <LicenseManagerPanel/>;}
