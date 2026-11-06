import AcceptStaffInvitation from "@/components/accept-staff-invitation";
export default async function AcceptStaffInvitationPage({searchParams}:{searchParams:Promise<{token?:string}>}){
 const params=await searchParams;
 return <AcceptStaffInvitation token={params.token??""}/>;
}
