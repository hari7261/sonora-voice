'use client';
import {useCallback,useEffect,useState} from 'react';
import {CreditCard,ShieldCheck,RefreshCw} from 'lucide-react';
type Package={id:string;name:string;description:string;credits:string;price_paise:string;currency:string};
type Order={id:string;package_id:string;credits:string;amount_paise:string;status:string;created_at:string;paid_at:string|null};
type Checkout={order_id:string;key_id:string;local_order_id:string;amount:number;currency:string};
type RazorpayConstructor=new(opts:{key:string;order_id:string;amount:number;currency:string;name:string;description:string;handler:(result:{razorpay_payment_id:string})=>void;modal:{ondismiss:()=>void}})=>{open:()=>void};
function loadCheckout():Promise<RazorpayConstructor>{
 return new Promise((resolve,reject)=>{
  const existing=(window as unknown as {Razorpay?:RazorpayConstructor}).Razorpay;
  if(existing){resolve(existing);return;}
  const s=document.createElement('script');s.src='https://checkout.razorpay.com/v1/checkout.js';s.async=true;
  s.onload=()=>{const ctor=(window as unknown as {Razorpay?:RazorpayConstructor}).Razorpay;
   ctor?resolve(ctor):reject(new Error('Payment checkout did not initialize'));};
  s.onerror=()=>reject(new Error('Unable to load secure payment checkout'));
  document.head.appendChild(s);
 });
}
export function BillingPanel(){
 const [packages,setPackages]=useState<Package[]>([]),[orders,setOrders]=useState<Order[]>([]),
 [available,setAvailable]=useState(false),[loading,setLoading]=useState(true),[working,setWorking]=useState(''),
 [error,setError]=useState(''),[notice,setNotice]=useState('');
 const refresh=useCallback(async()=>{
  try{
   const [p,o]=await Promise.all([fetch('/api/billing/packages',{cache:'no-store'}),fetch('/api/billing/orders',{cache:'no-store'})]);
   const pd=await p.json(),od=await o.json();
   if(!p.ok||!o.ok)throw new Error(pd.error||od.error||'Unable to load billing data');
   setPackages(pd.packages||[]);setAvailable(pd.checkout_available===true);setOrders(od.orders||[]);setError('');
  }catch(e){setError((e as Error).message)}
  finally{setLoading(false)}
 },[]);
 useEffect(()=>{void refresh()},[refresh]);
 async function buy(pkg:Package){
  setWorking(pkg.id);setError('');setNotice('');
  try{
   if(!available)throw new Error('Secure payments are not configured yet');
   const CheckoutClass=await loadCheckout();
   const r=await fetch('/api/billing/orders',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({package_id:pkg.id})});
   const d=await r.json() as Checkout&{error?:string};
   if(!r.ok)throw new Error(d.error||'Unable to create payment order');
   const payment=new CheckoutClass({
    key:d.key_id,order_id:d.order_id,amount:d.amount,currency:d.currency,
    name:'Vāchaspati AI',description:pkg.name+' · '+pkg.credits+' credits',
    handler:()=>{setNotice('Payment submitted. Credits will appear only after the verified provider webhook is processed.');void refresh();},
    modal:{ondismiss:()=>{setNotice('Checkout closed. Any captured payment will be reflected once verified.');void refresh();}}
   });
   payment.open();
  }catch(e){setError((e as Error).message)}
  finally{setWorking('')}
 }
 return <div className="billing-console">
  <header><p className="eyebrow">ACCOUNT / PREPAID BILLING</p><h1>Credits & payments.</h1>
   <p>Purchase additional credits securely. Prices, allowances and purchases are stored in PostgreSQL.</p></header>
  {error&&<p className="auth-error">{error}</p>}
  {notice&&<p className="admin-notice">{notice}</p>}
  {loading?<p>Loading billing products…</p>:<>
   <div className="billing-cards">{packages.map(p=><article key={p.id} className="billing-card">
    <CreditCard size={24}/><h2>{p.name}</h2><strong>{Number(p.credits).toLocaleString('en-IN')} credits</strong>
    <div className="billing-price">₹{(Number(p.price_paise)/100).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})}</div>
    <p>{p.description}</p>
    <button className="button button-dark" disabled={!available||working===p.id} onClick={()=>void buy(p)}>{working===p.id?'Preparing checkout…':available?'Buy credits':'Payment setup pending'}</button>
   </article>)}</div>
   {packages.length===0&&<p>No credit packages have been published by platform administration.</p>}
   <p className="micro muted"><ShieldCheck size={14}/> Credits are granted by a signed provider webhook, not by browser JavaScript. Pricing is shown in INR.</p>
   <div className="billing-history"><div className="billing-history-head"><h2>Payment history</h2><button className="button button-outline" onClick={()=>void refresh()}><RefreshCw size={15}/> Refresh</button></div>
    {orders.length===0?<p>No payment orders yet.</p>:<div className="admin-table-scroll"><table className="admin-data-table"><thead><tr><th>Created</th><th>Credits</th><th>Amount</th><th>Status</th></tr></thead><tbody>
    {orders.map(o=><tr key={o.id}><td>{new Date(o.created_at).toLocaleString()}</td><td>{Number(o.credits).toLocaleString('en-IN')}</td><td>₹{(Number(o.amount_paise)/100).toFixed(2)}</td><td>{o.status}</td></tr>)}</tbody></table></div>}
   </div>
  </>}
 </div>;
}
