import Link from 'next/link';
import {redirect} from 'next/navigation';
import {currentUser} from '../../../lib/server/credentials';
import {SupportPanel} from '../../../components/support';
export const runtime='nodejs';export const dynamic='force-dynamic';
export const metadata={title:'Support Center'};
export default async function Page(){
 if(!await currentUser())redirect('/login');
 return <div className="container account-dashboard"><Link className="text-link" href="/dashboard">Back to dashboard</Link><SupportPanel/></div>;
}
