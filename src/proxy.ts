import {NextRequest,NextResponse} from "next/server";
import {getApplicationLicenseState} from "@/lib/brandon-license";

const allowedPages=new Set([
 "/license",
 "/admin/license",
 "/portal/sign-in",
 "/portal/register",
 "/portal/verify-email",
 "/portal/forgot-password",
 "/portal/reset-password",
 "/portal/accept-staff-invitation"
]);
function isAllowedWithoutLicence(pathname:string){
 return allowedPages.has(pathname)||pathname.startsWith("/api/license/")||pathname==="/api/license"||pathname==="/api/admin/license"||pathname.startsWith("/api/auth/");
}
export async function proxy(request:NextRequest){
 const pathname=request.nextUrl.pathname;
 if(isAllowedWithoutLicence(pathname))return NextResponse.next();
 const state=await getApplicationLicenseState();
 if(state.valid)return NextResponse.next();
 if(pathname.startsWith("/api/")){
  return NextResponse.json({error:"Brandon RV requires an active application licence.",code:state.code,licenseRequired:true},{status:423});
 }
 const destination=new URL("/license",request.url);
 if(state.code!=="LICENSE_REQUIRED")destination.searchParams.set("reason",state.code);
 return NextResponse.redirect(destination);
}
export const config={matcher:["/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff2?)$).*)"]};
