import {Render} from "@puckeditor/core";
import {createWebsiteBuilderConfig} from "@/lib/website-builder";
import {getPublicBusinessSettings} from "@/lib/public-site";

type Props={data:unknown;services?:any[];areas?:any[]};
export default async function PublicSiteBuilder({data,services=[],areas=[]}:Props){
 if(!data||typeof data!=="object"||Array.isArray(data))return null;
 const builder=data as Record<string,unknown>;
 if(!Array.isArray(builder.content)||!builder.root)return null;
 const settings=await getPublicBusinessSettings();
 return <Render config={createWebsiteBuilderConfig({services,areas,acceptingEnquiries:settings.accepting_enquiries}) as any} data={builder as any}/>;
}
