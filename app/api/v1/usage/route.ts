import {NextRequest} from 'next/server';
import {keyWorkspace,apiError} from '../../../../lib/server/platform';
import {getCreditBalance} from '../../../../lib/server/credits';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(req:NextRequest){
 const who=await keyWorkspace(req,'usage:read');if(!who)return apiError('Valid usage API key required',401);
 try{
  const balance=await getCreditBalance(who.account_id);
  return Response.json({balance},{headers:{'Cache-Control':'no-store'}});
 }catch{return apiError('Usage unavailable',503);}
}
