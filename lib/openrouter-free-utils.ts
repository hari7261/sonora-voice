// Pure catalog filtering and ordering, shared by server routes and automated tests.
export const FREE_ROUTER_ID='openrouter/free';
export const MODEL_ID_PATTERN=/^[a-zA-Z0-9._/-]+(?::free)?$/;
export function isOpenRouterModelId(input:unknown):input is string{
 return typeof input==='string'&&input.length>=3&&input.length<=140&&MODEL_ID_PATTERN.test(input);
}
export type OpenRouterCatalogModel={
 id?:unknown;
 name?:unknown;
 context_length?:unknown;
 architecture?:{input_modalities?:unknown;output_modalities?:unknown}|null;
 pricing?:{prompt?:unknown;completion?:unknown;request?:unknown}|null;
};
export type FreeTextModel={id:string;name:string;context_length:number};
export type FallbackPreference={model_id:string;enabled:boolean;priority:number};
function priceIsZero(price:unknown):boolean{
 // Dynamic routers use negative sentinel prices; reject them.
 return (typeof price==='string'||typeof price==='number')&&String(price).trim()!==''&&
  Number.isFinite(Number(price))&&Number(price)===0;
}
export function isFreeTextChatModel(model:OpenRouterCatalogModel):model is OpenRouterCatalogModel&{id:string}{
 if(typeof model.id!=='string'||!MODEL_ID_PATTERN.test(model.id)||model.id.length>140)return false;
 if(!(model.id.endsWith(':free')||model.id===FREE_ROUTER_ID))return false;
 const prices=model.pricing;
 if(!prices||!priceIsZero(prices.prompt)||!priceIsZero(prices.completion))return false;
 // Request fees are possible even if input/output tokens cost zero.
 if(prices.request!==undefined&&prices.request!==null&&!priceIsZero(prices.request))return false;
 if(!Array.isArray(model.architecture?.input_modalities)||
    !model.architecture.input_modalities.includes('text'))return false;
 if(!Array.isArray(model.architecture?.output_modalities)||
    !model.architecture.output_modalities.includes('text'))return false;
 return true;
}
export function extractFreeTextModels(models:unknown):FreeTextModel[]{
 if(!Array.isArray(models))throw new Error('OPENROUTER_CATALOG_INVALID');
 const unique=new Map<string,FreeTextModel>();
 for(const raw of models){
  if(!raw||typeof raw!=='object')continue;
  const m=raw as OpenRouterCatalogModel;
  if(!isFreeTextChatModel(m))continue;
  const context=typeof m.context_length==='number'&&Number.isSafeInteger(m.context_length)?m.context_length:0;
  if(context<8192)continue;
  unique.set(m.id,{id:m.id,name:typeof m.name==='string'?m.name.slice(0,150):m.id,context_length:context});
 }
 return [...unique.values()];
}
export function arrangeFallbacks(primary:string,catalog:FreeTextModel[],prefs:FallbackPreference[]):string[]{
 const settings=new Map(prefs.map(p=>[p.model_id,p]));
 // Sort all current free models. Admin-defined rank takes priority; new models are auto-included.
 const sorted=catalog.filter(m=>m.id!==primary&&settings.get(m.id)?.enabled!==false)
   .sort((a,b)=>{
    if(a.id===FREE_ROUTER_ID)return 1;
    if(b.id===FREE_ROUTER_ID)return -1;
    const rankA=settings.get(a.id)?.priority??500;
    const rankB=settings.get(b.id)?.priority??500;
    return rankA-rankB||a.id.localeCompare(b.id);
   });
 return [primary,...sorted.map(m=>m.id)];
}
