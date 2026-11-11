import "server-only";
import {createCipheriv,createDecipheriv,createHash,randomBytes,randomUUID} from "node:crypto";
import {database} from "@/lib/auth";
import {createLicenseClient,LicenseError} from "@/lib/license-manager-client.js";

const PRODUCT_ID="brandon-rv";
const CACHE_MS=60_000;
type LicenseRecord={id:string;product_id:string;installation_id:string;encrypted_license_key:string;encryption_iv:string;encryption_tag:string};
type LicenseState={valid:boolean;code:string;message:string;product:string;installationId?:string;authority?:string;expiresAt?:string|null;entitlements?:Record<string,unknown>;offlineGrace?:boolean};

function encryptionKey(){
 const secret=process.env.BRANDON_RV_LICENSE_ENCRYPTION_SECRET;
 if(!secret||secret.length<32)throw new Error("BRANDON_RV_LICENSE_ENCRYPTION_SECRET must contain at least 32 characters.");
 return createHash("sha256").update(secret).digest();
}
function encrypt(value:string){
 const iv=randomBytes(12);const cipher=createCipheriv("aes-256-gcm",encryptionKey(),iv);
 const encrypted=Buffer.concat([cipher.update(value,"utf8"),cipher.final()]);
 return {encrypted_license_key:encrypted.toString("base64"),encryption_iv:iv.toString("base64"),encryption_tag:cipher.getAuthTag().toString("base64")};
}
function decrypt(row:LicenseRecord){
 const decipher=createDecipheriv("aes-256-gcm",encryptionKey(),Buffer.from(row.encryption_iv,"base64"));
 decipher.setAuthTag(Buffer.from(row.encryption_tag,"base64"));
 return Buffer.concat([decipher.update(Buffer.from(row.encrypted_license_key,"base64")),decipher.final()]).toString("utf8");
}
const clients=new Map<string,ReturnType<typeof createLicenseClient>>();
function clientFor(installationId:string,forceRecheck=false){
 let client=forceRecheck?undefined:clients.get(installationId);
 if(!client){
  const db=database();
  client=createLicenseClient({
   product:PRODUCT_ID,component:PRODUCT_ID,installationId,
   cacheValidForMs:forceRecheck?0:CACHE_MS,timeoutMs:7000,
   storage:{
    async get(){
     const {data,error}=await db.from("application_license").select("cached_validation").eq("id","primary").maybeSingle();
     if(error)throw error;
     return data?.cached_validation||null;
    },
    async set(_key:string,value:any){
     const {error}=await db.from("application_license").update({
      cached_validation:value,last_validated_at:new Date(Number(value.checkedAt||Date.now())).toISOString(),
      last_status:"valid",last_error_code:null,updated_at:new Date().toISOString()
     }).eq("id","primary");
     if(error)throw error;
    }
   }
  });
  if(!forceRecheck)clients.set(installationId,client);
 }
 return client;
}
function safeState(result:any):LicenseState{
 return {valid:true,code:String(result.code||"LICENSE_VALID"),message:result.offlineGrace?"Licence active (offline grace).":"Licence active.",product:PRODUCT_ID,installationId:result.installationId,authority:result.authority,expiresAt:result.expires_at||result.expiresAt||null,entitlements:result.entitlements||{},offlineGrace:result.offlineGrace===true};
}
export async function getApplicationLicenseState(options:{forceRecheck?:boolean}={}):Promise<LicenseState>{
 try{
  const {data,error}=await database().from("application_license").select("id,product_id,installation_id,encrypted_license_key,encryption_iv,encryption_tag").eq("id","primary").maybeSingle();
  if(error)throw error;
  if(!data)return {valid:false,code:"LICENSE_REQUIRED",message:"A Brandon RV licence has not been installed.",product:PRODUCT_ID};
  const row=data as LicenseRecord;
  if(row.product_id!==PRODUCT_ID)return {valid:false,code:"LICENSE_PRODUCT_MISMATCH",message:"The installed licence belongs to a different product.",product:PRODUCT_ID};
  const key=decrypt(row);
  const result=await clientFor(row.installation_id,options.forceRecheck===true).enforce({licenseKey:key,productVersion:process.env.BRANDON_RV_VERSION||"1.0.0"});
  return safeState(result);
 }catch(error:any){
  const code=String(error?.code||"LICENSING_UNAVAILABLE");
  const invalid=error instanceof LicenseError;
  return {valid:false,code,message:invalid?error.message:"Brandon RV could not verify its licence. Check the licence service and configuration.",product:PRODUCT_ID};
 }
}
export async function installApplicationLicense(licenseKey:string){
 const key=String(licenseKey||"").trim();
 if(!key||key.length>256)throw new LicenseError("Enter a valid licence key.",{code:"LICENSE_KEY_REQUIRED",status:400});
 const db=database();
 const {data:existing,error:readError}=await db.from("application_license").select("installation_id").eq("id","primary").maybeSingle();
 if(readError)throw readError;
 const installationId=existing?.installation_id||randomUUID();
 const result=await clientFor(installationId,true).enforce({licenseKey:key,productVersion:process.env.BRANDON_RV_VERSION||"1.0.0",action:"activate"});
 const encrypted=encrypt(key);
 const {error}=await db.from("application_license").upsert({id:"primary",product_id:PRODUCT_ID,installation_id:installationId,...encrypted,cached_validation:result,last_validated_at:new Date(Number(result.checkedAt||Date.now())).toISOString(),last_status:"valid",last_error_code:null,updated_at:new Date().toISOString()},{onConflict:"id"});
 if(error)throw error;
 return safeState(result);
}
export function licenseErrorStatus(error:any){return Number(error?.status||403);}
