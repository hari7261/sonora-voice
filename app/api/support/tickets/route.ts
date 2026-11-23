import {NextRequest} from 'next/server';
import {database} from '../../../../lib/server/db';
import {apiError,readJson,safeOrigin,userWorkspace} from '../../../../lib/server/platform';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(req:NextRequest){
 try{
 const who=await userWorkspace(req);if(!who)return apiError('Unauthorized',401);
 const r=await database().query('select id,subject,category,priority,status,created_at,updated_at from vachaspati_private.vachaspati_support_tickets where account_id=$1 order by updated_at desc limit 100',[who.account_id]);
 return Response.json({tickets:r.rows},{headers:{'Cache-Control':'no-store'}});
 }catch{return apiError('Support service unavailable',503);}
}
export async function POST(req:NextRequest){
 if(!safeOrigin(req))return apiError('Invalid origin',403);
 const b=await readJson(req,12500),subject=typeof b?.subject==='string'?b.subject.trim():'',
 category=typeof b?.category==='string'?b.category:'',message=typeof b?.message==='string'?b.message.trim():'';
 if(subject.length<4||subject.length>200||message.length<5||message.length>10000||
  !['billing','account','voice','agent','api','other'].includes(category))return apiError('Invalid support request',400);
 try{
 const who=await userWorkspace(req);if(!who)return apiError('Unauthorized',401);
 const client=await database().connect();
 try{
  await client.query('begin');
  const count=await client.query<{total:string}>("select count(*)::text as total from vachaspati_private.vachaspati_support_tickets where opened_by=$1 and created_at>now()-interval '1 hour'",[who.user_id]);
  if(Number(count.rows[0].total)>=8){await client.query('rollback');return apiError('Too many support requests',429);}
  const ticket=await client.query<{id:string}>('insert into vachaspati_private.vachaspati_support_tickets(account_id,opened_by,subject,category) values($1,$2,$3,$4) returning id',[who.account_id,who.user_id,subject,category]);
  await client.query('insert into vachaspati_private.vachaspati_support_messages(ticket_id,author_id,content) values($1,$2,$3)',[ticket.rows[0].id,who.user_id,message]);
  await client.query('commit');return Response.json({id:ticket.rows[0].id,status:'open'},{status:201});
 }catch(e){await client.query('rollback');throw e;}finally{client.release();}
 }catch{return apiError('Unable to create support ticket',503);}
}
