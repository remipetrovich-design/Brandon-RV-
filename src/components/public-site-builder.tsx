import {Render} from "@puckeditor/core";
import {createWebsiteBuilderConfig} from "@/lib/website-builder";

type Props={data:unknown;services?:any[];areas?:any[]};
export default function PublicSiteBuilder({data,services=[],areas=[]}:Props){
 if(!data||typeof data!=="object"||Array.isArray(data))return null;
 const builder=data as Record<string,unknown>;
 if(!Array.isArray(builder.content)||!builder.root)return null;
 return <Render config={createWebsiteBuilderConfig({services,areas}) as any} data={builder as any}/>;
}
