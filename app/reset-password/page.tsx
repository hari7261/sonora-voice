import {PasswordRecovery} from '../../components/password-recovery';
export const metadata={title:'Reset password'};
export default async function ResetPassword({searchParams}:{searchParams:Promise<{token?:string}>}){
 const params=await searchParams;return <PasswordRecovery token={params.token||undefined}/>;
}
