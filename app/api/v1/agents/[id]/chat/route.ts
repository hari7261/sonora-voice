import {NextRequest} from 'next/server';
import {validUuid,apiError,readJson} from '../../../../../../lib/server/platform';
import {publicAgent,agentChat} from '../../../../../../lib/server/agent-runtime';
import {QuotaError} from '../../../../../../lib/server/credits';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function POST(req:NextRequest,{params}:{params:Promise<{id:string}>}){
 const {id}=await params;if(!validUuid(id))return apiError('Invalid agent ID');
 const origin=req.headers.get('origin');if(!origin)return apiError('Origin required',403);
 const data=await readJson(req,6000);
 const text=typeof data?.text==='string'?data.text.trim():'';
 const sessionToken=typeof data?.sessionToken==='string'?data.sessionToken:undefined;
 if(!text||text.length>3000)return apiError('Message must be 1–3000 characters',400);
 try{
  const agent=await publicAgent(id,origin);if(!agent)return apiError('Unavailable for this origin',403);
  const response=await agentChat(agent,text,sessionToken);
  return Response.json(response,{headers:{'Cache-Control':'no-store','Vary':'Origin'}});
 }catch(e){
  if(e instanceof QuotaError)return apiError(e.reason,e.status);
  if(e instanceof Error&&e.message==='INVALID_SESSION')return apiError('Session is invalid or expired',401);
  if(e instanceof Error&&e.message==='OPENROUTER_NOT_CONFIGURED')return apiError('AI provider is not configured',503);
  return apiError('Agent service unavailable',503);
 }
}
