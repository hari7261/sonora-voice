import {NextRequest} from 'next/server';
import {database} from '../../../../../lib/server/db';
import {apiError,readJson,safeOrigin,userWorkspace,validUuid} from '../../../../../lib/server/platform';
export const runtime='nodejs';export const dynamic='force-dynamic';
type P={params:Promise<{id:string}>};
export async function GET(req:NextRequest,{params}:P){
 const id=(await params).id;if(!validUuid(id))return apiError('Invalid ticket ID');
 try{
 const who=await userWorkspace(req);if(!who)return apiError('Unauthorized',401);
 const t=await database().query('select id,subject,category,status,priority,created_at,updated_at from vachaspati_private.vachaspati_support_tickets where id=$1 and account_id=$2',[id,who.account_id]);
 if(!t.rows[0])return apiError('Ticket not found',404);
 const messages=await database().query('select m.id,m.author_id,u.display_name,m.content,m.created_at from vachaspati_private.vachaspati_support_messages m join vachaspati_private.vachaspati_users u on u.id=m.author_id where m.ticket_id=$1 and m.internal=false order by m.created_at asc limit 200',[id]);
 return Response.json({ticket:t.rows[0],messages:messages.rows});
 }catch{return apiError('Support service unavailable',503);}
}
export async function POST(req:NextRequest,{params}:P){
 if(!safeOrigin(req))return apiError('Invalid origin',403);
 const id=(await params).id;if(!validUuid(id))return apiError('Invalid ticket ID');
 const b=await readJson(req,11000),message=typeof b?.message==='string'?b.message.trim():'';
 if(!message||message.length>10000)return apiError('Invalid reply',400);
 try{
  const who=await userWorkspace(req);if(!who)return apiError('Unauthorized',401);
  const client=await database().connect();
  try{
   await client.query('begin');
   const t=await client.query("update vachaspati_private.vachaspati_support_tickets set updated_at=now(),status='open' where id=$1 and account_id=$2 and status<>'closed' returning id",[id,who.account_id]);
   if(!t.rowCount){await client.query('rollback');return apiError('Ticket not found or closed',404);}
   await client.query('insert into vachaspati_private.vachaspati_support_messages(ticket_id,author_id,content) values($1,$2,$3)',[id,who.user_id,message]);
   await client.query('commit');return Response.json({ok:true});
  }catch(e){await client.query('rollback');throw e;}finally{client.release();}
 }catch{return apiError('Unable to send reply',503);}
}
