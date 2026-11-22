import {NextRequest} from 'next/server';
import {widgetAccess,widgetError} from '../../../../../../lib/server/widget-http';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(req:NextRequest,{params}:{params:Promise<{id:string}>}){
 try{
  const access=await widgetAccess(req,(await params).id);
  if(!access)return widgetError('Agent unavailable for this website',403);
  const {agent,headers}=access;
  return Response.json({id:agent.id,name:agent.name,greeting:agent.greeting,
    accentColor:agent.accent_color,interactionMode:agent.interaction_mode,
    language:agent.language_code,voiceReady:!!process.env.SHERPA_INFERENCE_URL&&!!process.env.SHERPA_WORKER_SECRET},{headers});
 }catch{return widgetError('Agent unavailable',503);}
}
