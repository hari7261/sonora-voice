import {NextRequest} from 'next/server';
import {database} from '../../../../../lib/server/db';
import {requireAdmin} from '../../../../../lib/server/admin';
import {apiError,readJson,safeOrigin,validUuid} from '../../../../../lib/server/platform';
export const runtime='nodejs';export const dynamic='force-dynamic';
type P={params:Promise<{id:string}>};
export async function GET(req:NextRequest,{params}:P){
 const admin=await requireAdmin(req,['superadmin','operations','support']);if(!admin)return apiError('Forbidden',403);
 const id=(await params).id;if(!validUuid(id))return apiError('Invalid ticket ID');
 try{
  const ticket=await database().query('select id,subject,category,priority,status,account_id,opened_by,assigned_to,created_at from vachaspati_private.vachaspati_support_tickets where id=$1',[id]);
  if(!ticket.rows[0])return apiError('Ticket not found',404);
  const messages=await database().query('select m.id,m.author_id,u.email,m.internal,m.content,m.created_at from vachaspati_private.vachaspati_support_messages m join vachaspati_private.vachaspati_users u on u.id=m.author_id where m.ticket_id=$1 order by m.created_at asc limit 300',[id]);
  return Response.json({ticket:ticket.rows[0],messages:messages.rows});
 }catch{return apiError('Support service unavailable',503);}
}
export async function POST(req:NextRequest,{params}:P){
 if(!safeOrigin(req))return apiError('Invalid origin',403);
 const admin=await requireAdmin(req,['superadmin','operations','support']);if(!admin)return apiError('Forbidden',403);
 const id=(await params).id;if(!validUuid(id))return apiError('Invalid ticket ID');
 const b=await readJson(req,12000),message=typeof b?.message==='string'?b.message.trim():'';
 const nextStatus=typeof b?.status==='string'?b.status:'in_progress';
 if(!message||message.length>10000||!['open','in_progress','waiting_customer','resolved','closed'].includes(nextStatus))
  return apiError('Invalid reply or status',400);
 try{
 const client=await database().connect();
 try{
  await client.query('begin');
  const ticket=await client.query('update vachaspati_private.vachaspati_support_tickets set status=$2,assigned_to=$3,updated_at=now(),resolved_at=case when $2 in (\'resolved\',\'closed\') then now() else null end where id=$1 returning id',[id,nextStatus,admin.user_id]);
  if(!ticket.rowCount){await client.query('rollback');return apiError('Ticket not found',404);}
  const isInternal=b?.internal===true;
  await client.query('insert into vachaspati_private.vachaspati_support_messages(ticket_id,author_id,content,internal) values($1,$2,$3,$4)',[id,admin.user_id,message,isInternal]);
  await client.query("insert into vachaspati_private.vachaspati_admin_audit(actor_id,action,target_type,target_id,details) values($1,'ticket.replied','support_ticket',$2,$3::jsonb)",[admin.user_id,id,JSON.stringify({status:nextStatus,internal:isInternal})]);
  await client.query('commit');return Response.json({ok:true});
 }catch(e){await client.query('rollback');throw e;}finally{client.release();}
 }catch{return apiError('Unable to process support ticket',503);}
}
