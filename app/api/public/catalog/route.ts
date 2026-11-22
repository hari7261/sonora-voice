import {database} from '../../../../lib/server/db';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(){
 try{
  const [models,plans]=await Promise.all([
   database().query(`select id,name,capability,description from vachaspati_private.vachaspati_voice_models where enabled=true order by capability,name`),
   database().query(`select code,name,monthly_credits,daily_limit,weekly_limit,monthly_limit,concurrency_limit from vachaspati_private.vachaspati_plans where enabled=true order by monthly_credits asc`)
  ]);
  return Response.json({models:models.rows,plans:plans.rows},{headers:{'Cache-Control':'public,max-age=30'}});
 }catch{return Response.json({error:'Catalog currently unavailable'},{status:503});}
}
