import { destroySession,jsonError,sameOrigin } from "@/lib/auth";
export const runtime="nodejs";
export async function POST(request:Request){
 if(!sameOrigin(request)) return jsonError("Invalid request origin.",403);
 try{await destroySession();return Response.json({success:true});}
 catch{return jsonError("Could not end the session.",500);}
}