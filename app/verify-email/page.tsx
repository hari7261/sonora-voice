import {EmailVerification} from '../../components/email-verification';
export const metadata={title:'Verify email address'};
export default async function Page({searchParams}:{searchParams:Promise<{token?:string}>}){
 const p=await searchParams;return <EmailVerification token={p.token}/>;
}
