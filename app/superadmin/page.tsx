import {redirect} from 'next/navigation';
import {cookies} from 'next/headers';
import {adminFromSession,ADMIN_COOKIE} from '../../lib/server/admin';
import {AdminConsole} from '../../components/admin-console';
export const runtime='nodejs';export const dynamic='force-dynamic';
export const metadata={title:'Super Admin • Vāchaspati Control'};
export default async function Page(){
 const c=await cookies();
 // Construct an internal request-like object solely to pass the request's signed admin cookie;
 // the session itself is verified again against the live database on each administrator API call.
 const req={cookies:{get:(name:string)=>c.get(name)}} as Parameters<typeof adminFromSession>[0];
 const admin=await adminFromSession(req);
 if(!admin)redirect('/superadmin/login');
 return <div className="container admin-page"><div className="admin-heading"><p className="eyebrow">VĀCHASPATI AI / RESTRICTED CONTROL</p><h1>Platform operations.</h1>
 <p>Role: <strong>{admin.role}</strong> · {admin.email}</p></div>
 <AdminConsole role={admin.role}/></div>;
}
