import 'server-only';
import {randomBytes} from 'node:crypto';
import {database} from './db';
import {sha256} from './credentials';
import {accountAgent,hostAllowed} from './platform';
import {generateReply,AiMessage} from './openrouter';
import {reserveCredits,finishUsage} from './credits';
const S='vachaspati_private';
type RuntimeAgent={id:string;account_id:string;name:string;instructions:string;greeting:string;llm_model:string|null;status:string;language_code:string;voice_id:string|null;accent_color:string;interaction_mode:string};
export async function publicAgent(agentId:string,origin:string){
 const r=await database().query<RuntimeAgent & {domains:string[]}>(`
  select a.id,a.account_id,a.name,a.instructions,a.greeting,a.llm_model,a.status,a.language_code,a.voice_id,
   a.accent_color,a.interaction_mode,
   array(select domain from ${S}.vachaspati_agent_domains where agent_id=a.id) as domains
  from ${S}.vachaspati_agents a where a.id=$1 and a.status='active' limit 1`,[agentId]);
 const agent=r.rows[0];
 return agent&&hostAllowed(origin,agent.domains)?agent:null;
}
async function conversation(agentId:string,sessionToken:string|undefined){
 if(sessionToken){
  if(!/^[A-Za-z0-9_-]{43}$/.test(sessionToken))throw new Error('INVALID_SESSION');
  const r=await database().query<{id:string}>(`select id from ${S}.vachaspati_conversations
   where agent_id=$1 and session_token_hash=$2 and ended_at is null`,[agentId,sha256(sessionToken)]);
  if(!r.rows[0])throw new Error('INVALID_SESSION');
  return {id:r.rows[0].id,sessionToken};
 }
 const token=randomBytes(32).toString('base64url');
 const r=await database().query<{id:string}>(`insert into ${S}.vachaspati_conversations(agent_id,session_token_hash)
 values($1,$2) returning id`,[agentId,sha256(token)]);
 return {id:r.rows[0].id,sessionToken:token};
}
export async function agentChat(agent:RuntimeAgent,text:string,token?:string){
 if(!agent.llm_model)throw new Error('MODEL_NOT_CONFIGURED');
 if(!text.trim()||text.length>3000)throw new Error('INVALID_MESSAGE');
 const session=await conversation(agent.id,token);
 const history=await database().query<{role:'user'|'assistant';content:string}>(`
 select role,content from ${S}.vachaspati_messages where conversation_id=$1
 and role in ('user','assistant') order by created_at desc,id desc limit 20`,[session.id]);
 const context:AiMessage[]=[
  {role:'system',content:agent.instructions||'Assist the visitor accurately and concisely. Do not claim actions you cannot perform.'},
  ...history.rows.reverse(),
  {role:'user',content:text}];
 const reserved=await reserveCredits(agent.account_id,'agent',1);
 try{
  const answer=await generateReply(agent.llm_model,context);
  const client=await database().connect();
  try{
   await client.query('begin');
   await client.query(`insert into ${S}.vachaspati_messages(conversation_id,role,content)
     values($1,'user',$2),($1,'assistant',$3)`,[session.id,text,answer]);
   await client.query('commit');
  }catch(e){await client.query('rollback');throw e;}finally{client.release();}
  await finishUsage(agent.account_id,reserved.requestId,'agent',1,reserved.credits,200);
  return {text:answer,sessionToken:session.sessionToken,conversationId:session.id};
 }catch(e){
  await finishUsage(agent.account_id,reserved.requestId,'agent',1,reserved.credits,503);
  throw e;
 }
}
