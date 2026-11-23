import Link from 'next/link';
import {redirect} from 'next/navigation';
import {currentUser} from '../../../lib/server/credentials';
import {BillingPanel} from '../../../components/billing';
export const runtime='nodejs';export const dynamic='force-dynamic';
export const metadata={title:'Billing & Credits'};
export default async function Page(){
 const user=await currentUser();if(!user)redirect('/login');
 return <div className="container account-dashboard"><Link className="text-link" href="/dashboard">Back to dashboard</Link><BillingPanel/></div>;
}
