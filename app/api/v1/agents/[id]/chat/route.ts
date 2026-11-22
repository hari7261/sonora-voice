import {NextRequest} from 'next/server';
import {readJson} from '../../../../../../lib/server/platform';
import {agentChat} from '../../../../../../lib/server/agent-runtime';
import {widgetAccess,widgetError,publicThrottle} from '../../../../../../lib/server/widget-http';
import {QuotaError} from '../../../../../../lib/server/credits';
export const runtime='nodejs';export const dynamic='force-dynamic';
type P={params:Promise<{id:string}>};
export async function OPTIONS(req:NextRequest,{params}:P){
 const access=await widgetAccess(req,(await params).id);
 return access?new Response(null,{status:204,headers:access.headers}):new Response(null,{status:403});
}
export async function POST(req:NextRequest,{params}:P){
 const id=(await params).id;
 try{
  const access=await widgetAccess(req,id);
  if(!access)return widgetError('Agent is unavailable for this domain',403);
  const data=await readJson(req,6000);
  const text=typeof data?.text==='string'?data.text.trim():'';
  const sessionToken=typeof data?.sessionToken==='string'?data.sessionToken:undefined;
  if(!text||text.length>3000)return widgetError('Message must be 1–3000 characters',400,access.headers);
  if(!await publicThrottle(req,id))return widgetError('Too many requests',429,access.headers);
  const result=await agentChat(access.agent,text,sessionToken);
  return Response.json(result,{headers:access.headers});
 }catch(e){
  const origin=req.headers.get('origin')||'';
  const headers=origin?{'Access-Control-Allow-Origin':origin,'Vary':'Origin'}:undefined;
  if(e instanceof QuotaError)return widgetError(e.reason,e.status,headers);
  if(e instanceof Error&&e.message==='INVALID_SESSION')return widgetError('Session is invalid',401,headers);
  return widgetError('Agent service unavailable',503,headers);
 }
}
