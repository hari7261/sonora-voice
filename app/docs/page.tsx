import Link from 'next/link';
import {ArrowUpRight,BookOpen,Code2,Info,KeyRound,ShieldCheck,Mic2,Volume2} from 'lucide-react';
import {Copy} from '../../components/interactive';
export const metadata={title:'API Documentation'};
const sections=[
 ['Getting started',[['Introduction','introduction'],['Quickstart','quickstart'],['Authentication','authentication'],['Base URL','base-url']]],
 ['API Reference',[['Transcriptions','transcriptions'],['Speech synthesis','speech'],['Agents','agents'],['Credits and usage','limits']]],
 ['Integration',[['Embed widget','embed'],['Multilingual models','languages'],['Security','security'],['Errors','errors'],['Deployment checklist','production']]]
];
const host='https://YOUR_DEPLOYED_VACHASPATI_DOMAIN';
const stt=`curl -X POST "${host}/api/v1/audio/transcriptions" \\
  -H "Authorization: Bearer YOUR_PRIVATE_API_KEY" \\
  -F "file=@speech.wav;type=audio/wav" \\
  -F "language=en"`;
const tts=`curl -X POST "${host}/api/v1/audio/speech" \\
  -H "Authorization: Bearer YOUR_PRIVATE_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"text":"Welcome to Vachaspati AI","language":"en","voice":"default"}' \\
  --output result.wav`;
const chat=`fetch('/api/v1/agents/AGENT_UUID/chat', {
  method:'POST',
  headers:{'Content-Type':'application/json'},
  body:JSON.stringify({text:'How can I help?',sessionToken})
}).then(r=>r.json());`;
const widget=`<script src="${host}/widget.js"
  data-agent-id="YOUR_PUBLISHED_AGENT_UUID"
  async></script>`;
function Block({id,title,children}:{id:string;title:string;children:React.ReactNode}){
 return <section className="doc-block" id={id}><h2>{title}</h2>{children}</section>
}
function Code({label,code}:{label:string;code:string}){
 return <div className="doc-code"><div><span>{label}</span><Copy value={code}/></div><pre>{code}</pre></div>
}
export default function Docs(){
 return <><div className="docs-heading"><div className="container"><span>VĀCHASPATI AI / DEVELOPERS</span><h1>Build with real voice APIs.</h1><p>Custom email/password accounts, scoped API keys, OpenRouter agents, metered credits and deployable Sherpa-ONNX speech inference.</p></div></div>
 <div className="container docs-layout">
  <aside className="docs-sidebar"><div className="docs-sidebar-head"><strong><BookOpen size={17}/> DOCUMENTATION</strong></div>{sections.map(([title,groups])=><div className="docs-nav-group" key={title as string}><span>{title as string}</span>{(groups as string[][]).map(([name,id])=><a href={'#'+id} key={id}>{name}</a>)}</div>)}</aside>
  <article className="docs-content">
   <div className="doc-alert"><Info size={20}/><p><strong>Deployment requirement:</strong> REST routes are implemented in GitHub. Live requests require a configured PostgreSQL connection, an OpenRouter API key, and a separately hosted Sherpa-ONNX inference worker for audio. Do not use these examples until the deployment is ready.</p></div>
   <Block id="introduction" title="Introduction"><p>Vāchaspati AI uses Next.js route handlers, PostgreSQL-hosted customer data and OpenRouter for conversational agent responses. Supabase Auth is not used. All data tables live in the private <code>vachaspati_private</code> schema with names starting <code>vachaspati_</code>.</p></Block>
   <Block id="quickstart" title="Quickstart">
    <p>Register at <Link href="/signup">Create account</Link>, sign in and open your <Link href="/dashboard">dashboard</Link>. Create a developer key with <code>audio:write</code> and <code>usage:read</code> scopes, then call the REST endpoints from your backend.</p>
    <p>Your key is shown only once. Never put it into public HTML, a mobile application bundle or a Git repository.</p>
    <Code label="TRANSCRIPTION · CURL" code={stt}/>
   </Block>
   <Block id="authentication" title="Authentication"><p>Account login uses a custom email/password identity system, salted scrypt hashes and HttpOnly session cookies. Developer requests require a private bearer key stored as a SHA-256 hash in PostgreSQL.</p>
    <Code label="REQUEST HEADER" code={'Authorization: Bearer YOUR_PRIVATE_API_KEY'}/>
    <p>API key scopes include <code>agents:read</code>, <code>agents:write</code>, <code>audio:write</code>, and <code>usage:read</code>. Revoke keys immediately from the dashboard.</p>
   </Block>
   <Block id="base-url" title="Base URL and versions"><p>Use your actual deployed Vāchaspati domain and prefix API requests with <code>/api/v1</code>. The API is currently versioned as v1.</p>
    <p>Base URL: <code>{host}/api/v1</code></p></Block>
   <Block id="transcriptions" title="Speech to text"><p><code>POST /api/v1/audio/transcriptions</code> accepts a multipart form upload called <code>file</code>, containing PCM16 WAV audio (8–48 kHz, mono/stereo), at most 10 MB and 120 seconds. Optional <code>language</code> uses a validated locale code. Requires <code>audio:write</code>.</p>
    <Code label="CURL" code={stt}/><p>Successful response includes <code>text</code>, <code>duration_seconds</code> and <code>request_id</code>. Audio is processed using an actual configured Sherpa recognizer; unavailable models return an error, never a fabricated transcript.</p></Block>
   <Block id="speech" title="Text to speech"><p><code>POST /api/v1/audio/speech</code> accepts JSON with <code>text</code>, <code>voice</code> and <code>language</code> and returns real <code>audio/wav</code> bytes. Requires <code>audio:write</code>. Text is limited to 5,000 characters.</p>
    <Code label="CURL" code={tts}/>
   </Block>
   <Block id="agents" title="Voice agent API"><p>Agent configuration is persisted in PostgreSQL. Authorized API callers can list, create, inspect, update and delete agents using <code>GET/POST /api/v1/agents</code> and <code>GET/PATCH/DELETE /api/v1/agents/AGENT_UUID</code>.</p>
    <p>Public widget chat uses <code>POST /api/v1/agents/AGENT_UUID/chat</code>, requires an approved website origin, and records conversations with an opaque session token. Agent replies are generated via the configured OpenRouter model; no hardcoded answers are used.</p>
    <Code label="WIDGET CONVERSATION" code={chat}/>
   </Block>
   <Block id="limits" title="Credits and quotas"><p>Every successful AI interaction, transcription and synthesis is metered using rates from <code>vachaspati_rates</code>. Requests reserve credits atomically before provider calls. Failure returns the reservation as a refund in the ledger. Daily, weekly and monthly limits, and concurrent-request caps, are enforced on the database.</p>
    <p><code>GET /api/v1/usage</code> returns the actual subscription credit balance. Requires <code>usage:read</code>.</p></Block>
   <Block id="embed" title="Embed your voice agent"><p>In the dashboard: create an agent, specify a valid OpenRouter model, provide instructions, list approved website domains and publish the agent. Copy its unique embed tag.</p>
    <Code label="WEBSITE SCRIPT" code={widget}/>
    <p>The Shadow DOM widget uses real chat, optional microphone-to-WAV transcription and optional voice playback through the configured worker. Browsers require HTTPS and microphone permission. Website origin checks, per-visitor throttling and credit quotas apply.</p></Block>
   <Block id="languages" title="Multilingual models"><p>Languages and model availability are stored in <code>vachaspati_model_languages</code> and <code>vachaspati_voice_models</code>. A language is only advertised as available after an appropriate speech model is installed and tested; no locale is assumed to be supported merely from its code.</p></Block>
   <Block id="security" title="Security"><p>Credentials remain server-side. All tenant queries are restricted to the authenticated account. API keys and session tokens are stored as nonreversible hashes, cookies are HttpOnly and SameSite, and public widget requests require an approved origin. The inference worker has a shared secret and must run on a private network.</p>
    <p>A production installation must additionally configure an email verification and password recovery provider, network-level abuse protection, TLS, backups, model licenses and privacy retention rules.</p></Block>
   <Block id="errors" title="Errors and retries"><p><code>400</code>: invalid input. <code>401</code>: missing, revoked or wrong-scoped key. <code>403</code>: domain or role denied. <code>413</code>: upload too large. <code>429</code>: quota or request limit. <code>503</code>: provider, model or database unavailable.</p>
    <p>Use backoff for 429/503 errors. Do not retry a failed POST indefinitely without application-level idempotency controls.</p></Block>
   <Block id="production" title="Production checklist"><p>The GitHub repository includes SQL migrations and a dedicated <code>worker/</code> Docker image. Deployment requires a Supabase PostgreSQL connection string, an OpenRouter key, a private Sherpa worker URL, a worker secret, licensed model weights, allowed website domains and end-to-end tests.</p>
    <p>Streaming WebSockets, payment checkout and paid subscriptions are not yet live. Their absence is intentionally stated rather than simulated.</p>
    <Link className="text-link" href="/dashboard">Open dashboard <ArrowUpRight size={16}/></Link>
   </Block>
  </article>
 </div></>;
}
