import {database} from '../../../../lib/server/db';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(){
 try{
  const r=await database().query("select id,title,content,audience,created_at from vachaspati_private.vachaspati_announcements where published=true order by created_at desc limit 10");
  return Response.json({announcements:r.rows},{headers:{'Cache-Control':'public,max-age=30'}});
 }catch{return Response.json({error:'Announcements unavailable'},{status:503});}
}
