import {notFound} from 'next/navigation';
import Link from 'next/link';
import {ArrowUpRight,ArrowRight,AudioLines} from 'lucide-react';
import {database} from '../../../lib/server/db';
import {CTA,Eyebrow} from '../../../components/sections';
export const dynamic='force-dynamic';
type Model={id:string;name:string;capability:string;description:string;created_at:string;languages:string[]};
async function findModel(id:string):Promise<Model|null>{
 if(!/^[a-z0-9][a-z0-9._-]{2,75}$/.test(id))return null;
 const r=await database().query<Model>(`select m.id,m.name,m.capability,m.description,m.created_at,
 coalesce(array_agg(l.language_code) filter(where l.language_code is not null),'{}'::text[]) as languages
 from vachaspati_private.vachaspati_voice_models m
 left join vachaspati_private.vachaspati_model_languages l on l.model_id=m.id
 where m.id=$1 and m.enabled=true group by m.id`,[id]);
 return r.rows[0]??null;
}
export async function generateMetadata({params}:{params:Promise<{slug:string}>}){
 const m=await findModel((await params).slug);return {title:m?m.name:'Model not found'};
}
export default async function ModelDetail({params}:{params:Promise<{slug:string}>}){
 const model=await findModel((await params).slug);if(!model)return notFound();
 const endpoints:Record<string,string>={
  stt:'POST /api/v1/audio/transcriptions',tts:'POST /api/v1/audio/speech',
  agent:'POST /api/v1/agents/:id/chat',v2v:'POST /api/v1/agents/:id/transcribe',
  multilingual:'GET /api/public/catalog'};
 return <><div className="model-hero"><div className="container model-hero-inner">
 <div><Link href="/models" className="back-link">← All models</Link>
  <Eyebrow>{model.id.toUpperCase()} / {model.capability.toUpperCase()}</Eyebrow>
  <h1>{model.name}<span className="model-hero-period">.</span></h1>
  <h2>Database-managed voice model.</h2><p>{model.description}</p>
  <div className="hero-cta"><Link className="button button-dark" href="/docs#quickstart">Integration guide <ArrowUpRight size={16}/></Link>
  <Link className="button button-outline" href="/api">API reference <ArrowRight size={16}/></Link></div></div>
 <div className="model-cover"><div className="cover-top">VĀCHASPATI AI / ACTIVE MODEL</div>
  <div className="model-cover-symbol"><AudioLines size={110} strokeWidth={.7}/></div><span>{model.id.toUpperCase()}</span></div>
 </div></div>
 <section className="container section"><div className="spec-grid"><div><Eyebrow>LIVE MODEL REGISTRY</Eyebrow>
  <h2>Configured by operations.</h2>
  <p>Only administrator-enabled model records are listed. Speech availability also depends on the inference worker and loaded licensed weights.</p>
 </div><div className="spec-table">{([
  ['Model ID',model.id],['Capability',model.capability],
  ['API endpoint',endpoints[model.capability]||'See API docs'],
  ['Registered locales',model.languages.length?model.languages.join(', '):'No validated languages published'],
  ['Catalog status','Administrator enabled']
 ] as const).map(([key,value])=><div key={key}><span>{key}</span><strong>{value}</strong></div>)}</div></div></section>
 <CTA label="Integrate a real voice capability."/></>;
}
