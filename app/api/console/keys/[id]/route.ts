import {NextRequest} from 'next/server';
import {database} from '../../../../../lib/server/db';
import {apiError,safeOrigin,userWorkspace,validUuid} from '../../../../../lib/server/platform';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function DELETE(req:NextRequest,{params}:{params:Promise<{id:string}>}){
 if(!safeOrigin(req))return apiError('Disallowed origin',403);
 const {id}=await params;if(!validUuid(id))return apiError('Invalid key ID');
 try{
  const who=await userWorkspace(req,['owner','admin']);if(!who)return apiError('Unauthorized',401);
  const r=await database().query(`update vachaspati_private.vachaspati_api_keys set revoked_at=now()
  where id=$1 and account_id=$2 and revoked_at is null returning id`,[id,who.account_id]);
  return r.rowCount?Response.json({ok:true}):apiError('Key not found',404);
 }catch{return apiError('Unable to revoke key',503);}
}
