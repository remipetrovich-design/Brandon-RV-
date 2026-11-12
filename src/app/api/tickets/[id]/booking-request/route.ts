import {jsonError,sameOrigin} from "@/lib/auth";
export const runtime="nodejs";
export async function GET(){return jsonError("Guest access is limited to quote responses and general enquiry messages. Create a customer account for bookings and Workcard access.",403);}
export async function POST(request:Request){if(!sameOrigin(request))return jsonError("Invalid request origin.",403);return jsonError("Guest access is limited to quote responses and general enquiry messages. Create a customer account for bookings and Workcard access.",403);}
