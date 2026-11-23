import Link from 'next/link';
import {redirect} from 'next/navigation';
import {database} from '../../lib/server/db';
import {currentUser} from '../../lib/server/credentials';
import {LogoutButton} from '../../components/auth-form';
import {Console} from '../../components/console';
import {Announcements} from '../../components/announcements';
export const dynamic='force-dynamic';
export const metadata={title:'Dashboard'};
export default async function DashboardPage(){
 const user=await currentUser();if(!user)redirect('/login');
 const accounts=await database().query<{id:string;name:string;agent_count:string}>(`
   select a.id,a.name,count(g.id)::text as agent_count
   from vachaspati_private.vachaspati_accounts a
   join vachaspati_private.vachaspati_account_members m on m.account_id=a.id
   left join vachaspati_private.vachaspati_agents g on g.account_id=a.id
   where m.user_id=$1 group by a.id,a.name order by a.created_at asc`,[user.id]);
 return <div className="container account-dashboard">
   <div className="account-dashboard-head"><div><p className="eyebrow">ACCOUNT / DASHBOARD</p><h1>Welcome, {user.display_name}.</h1><p>Signed in as {user.email}</p></div><LogoutButton/></div>
   <h2>Your workspaces</h2><div className="account-workspaces">{accounts.rows.map(a=><div key={a.id} className="account-workspace"><h3>{a.name}</h3><p>{a.agent_count} configured agents</p><span className="micro muted">Workspace ID: {a.id}</span></div>)}</div>
   <div className="console-actions"><Link className="button button-outline" href="/dashboard/billing">Billing & prepaid credits</Link>
   <Link className="button button-outline" href="/dashboard/support">Customer support</Link></div>
   <Announcements/>
   <Console/>
 </div>;
}
