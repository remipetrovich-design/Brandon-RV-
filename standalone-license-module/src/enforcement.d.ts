import type {LicenseValidation} from "./index.js";
export function requireFeature(validation:LicenseValidation,feature:string):true;
export function withLicense<TContext,TResult>(client:{enforce(input:any):Promise<LicenseValidation>},handler:(context:TContext,validation:LicenseValidation)=>Promise<TResult>|TResult,options?:{feature?:string;getLicenseInput?:(context:TContext)=>Promise<any>|any}):(context:TContext)=>Promise<TResult>;
export function licenseMiddleware(client:{enforce(input:any):Promise<LicenseValidation>},options?:{feature?:string;getLicenseInput?:(request:any)=>Promise<any>|any}):(request:any,response:any,next:()=>any)=>Promise<any>;
