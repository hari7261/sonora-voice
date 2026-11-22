import {NextRequest,NextResponse} from 'next/server';
import {database} from '../../../../lib/server/db';
import {SESSION_COOKIE,createSession,emailAddress,getSessionUser,hashPassword,isLoginRateLimited,passwordAcceptable,recordFailedLogin,revokeSession,sessionCookieOptions,verifyPassword} from '../../../../lib/server/credentials';

export const runtime='nodejs';
export const dynamic='force-dynamic';
type Params={params:Promise<{action:string}>};
function json(body:unknown,status=200){
  const r=NextResponse.json(body,{status});
  r.headers.set('Cache-Control','no-store');
  return r;
}
function validOrigin(req:NextRequest){
  const origin=req.headers.get('origin');
  const requested=new URL(req.url).origin;
  return !!origin&&(origin===requested||(!!process.env.APP_ORIGIN&&origin===process.env.APP_ORIGIN));
}
async function body(req:NextRequest):Promise<Record<string,unknown>|null>{
  if(Number(req.headers.get('content-length')||0)>4096)return null;
  const raw=await req.text();
  if(raw.length>4096)return null;
  try {
    const data:unknown=JSON.parse(raw);
    return data!==null&&typeof data==='object'&&!Array.isArray(data)?data as Record<string,unknown>:null;
  }catch{return null;}
}
function requestIp(req:NextRequest){
  return (req.headers.get('x-forwarded-for')||req.headers.get('x-real-ip')||'unknown').split(',')[0].trim().slice(0,80);
}
function serviceError(error:unknown){
  if(error instanceof Error&&error.message.startsWith('DATABASE_URL is required'))return json({error:'Authentication database is not configured.'},503);
  return json({error:'Authentication service temporarily unavailable.'},503);
}
export async function GET(req:NextRequest,{params}:Params){
  if((await params).action!=='me')return json({error:'Not found'},404);
  try {
    const user=await getSessionUser(req.cookies.get(SESSION_COOKIE)?.value);
    return json({authenticated:!!user,user:user??null});
  }catch(e){return serviceError(e);}
}
export async function POST(req:NextRequest,{params}:Params){
  const action=(await params).action;
  if(!['register','login','logout'].includes(action))return json({error:'Not found'},404);
  if(!validOrigin(req))return json({error:'Request origin not permitted'},403);
  if(action==='logout'){
    try {
      await revokeSession(req.cookies.get(SESSION_COOKIE)?.value);
      const response=json({ok:true});
      response.cookies.set(SESSION_COOKIE,'',{...sessionCookieOptions(),maxAge:0});
      return response;
    }catch(e){return serviceError(e);}
  }
  const data=await body(req);
  if(!data)return json({error:'Invalid request'},400);
  const email=emailAddress(data.email);
  if(!email||!passwordAcceptable(data.password))return json({error:'Provide a valid email and a password of 12–128 characters.'},400);
  const password=data.password;
  if(action==='register'){
    const displayName=typeof data.displayName==='string'?data.displayName.trim():'';
    if(!displayName||displayName.length>120)return json({error:'Name must be between 1 and 120 characters.'},400);
    let client;
    try {
      const identifier='register:'+email+':'+requestIp(req);
      if(await isLoginRateLimited(identifier))return json({error:'Registration limit exceeded. Try again later.'},429);
      await recordFailedLogin(identifier);
      const passwordHash=await hashPassword(password);
      client=await database().connect();
      await client.query('begin');
      const created=await client.query<{id:string}>(
        'insert into vachaspati_private.vachaspati_users(email,password_hash,display_name) values($1,$2,$3) returning id',
        [email,passwordHash,displayName]);
      const userId=created.rows[0].id;
      const createdAccount=await client.query<{id:string}>(
        `insert into vachaspati_private.vachaspati_accounts(owner_id,name,plan_id)
          values($1,$2,(select id from vachaspati_private.vachaspati_plans where enabled=true order by monthly_credits asc limit 1)) returning id`,
        [userId,displayName+' workspace']);
      await client.query(
        'insert into vachaspati_private.vachaspati_account_members(account_id,user_id,role) values($1,$2,$3)',
        [createdAccount.rows[0].id,userId,'owner']);
      await client.query('commit');
      const token=await createSession(userId);
      const response=json({ok:true,user:{id:userId,email,display_name:displayName}},201);
      response.cookies.set(SESSION_COOKIE,token,sessionCookieOptions());
      return response;
    }catch(e){
      if(client)try{await client.query('rollback');}catch{}
      if((e as {code?:string}).code==='23505')return json({error:'An account with this email already exists.'},409);
      return serviceError(e);
    }finally{client?.release();}
  }
  const identifier='login:'+email+':'+requestIp(req);
  try {
    if(await isLoginRateLimited(identifier))return json({error:'Too many attempts. Please try again later.'},429);
    const result=await database().query<{id:string;email:string;display_name:string;password_hash:string;disabled_at:Date|null}>(
      'select id,email,display_name,password_hash,disabled_at from vachaspati_private.vachaspati_users where email=$1 limit 1',[email]);
    const user=result.rows[0];
    // Perform an equivalent scrypt operation for unknown users to limit timing disclosure.
    const matches=user?await verifyPassword(password,user.password_hash):(await hashPassword(password),false);
    if(!user||!matches||user.disabled_at){
      await recordFailedLogin(identifier);
      return json({error:'Invalid email or password.'},401);
    }
    const token=await createSession(user.id);
    const response=json({ok:true,user:{id:user.id,email:user.email,display_name:user.display_name}});
    response.cookies.set(SESSION_COOKIE,token,sessionCookieOptions());
    return response;
  }catch(e){return serviceError(e);}
}
