import {actionUrl,escapeHtml,safeEqual,verifyWebhook} from './security.ts';
// The email designs: two shared layouts plus each email's words (see scripts/email-previews.mjs).
import packed from './templates.compact.json' with {type:'json'};
import {unpack} from './unpack.mjs';
const templates=unpack(packed);
const project=Deno.env.get('SUPABASE_URL')!;
const service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const endpoint=project+'/functions/v1/pheelm-email';
const BASE='https://www.pheelm.com';
async function rpc(name:string,args:Record<string,unknown>={}){const r=await fetch(project+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:service,Authorization:'Bearer '+service,'Content-Type':'application/json'},body:JSON.stringify(args),signal:AbortSignal.timeout(10000)});if(!r.ok)throw new Error('Database operation failed: '+name);return r.status===204?null:await r.json();}
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
function page(title:string,message:string,action?:string,token?:string){return new Response(`<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} · Pheelm</title><body style="margin:24px;background:#0b0b0b;color:white;font:16px Arial,sans-serif"><main style="max-width:560px;margin:auto"><h1>${title}</h1><p>${message}</p>${action&&token?`<form method="post" action="${endpoint}?action=${action}"><input type="hidden" name="token" value="${escapeHtml(token)}"><button style="padding:14px 24px;border-radius:24px;border:0;font:inherit">${action==='confirm'?'Confirm subscription':'Unsubscribe from optional emails'}</button></form>`:''}<p><a style="color:white" href="${BASE}">Return to Pheelm</a></p></main></body></html>`,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'"}});}
Deno.serve(async req=>{try{const url=new URL(req.url);const action=url.searchParams.get('action')??'process';
 if(action==='confirm'||action==='unsubscribe'){
  if(req.method!=='GET'&&req.method!=='POST')return json({error:'Method not allowed'},405);
  // GET never changes state: mail scanners cannot subscribe/unsubscribe a member.
  const token=req.method==='POST'?String((await req.formData()).get('token')??url.searchParams.get('token')??''):url.searchParams.get('token')??'';
  if(!/^[a-f0-9]{64}$/.test(token))return page('Invalid link','Please use the link in your latest Pheelm email.');
  if(req.method==='GET')return page(action==='confirm'?'Confirm your newsletter subscription':'Email preferences',action==='confirm'?'Confirm below if you asked to receive the Pheelm newsletter.':'This stops optional Pheelm emails. Essential account and security messages will continue.',action,token);
  const ok=await rpc('email_token_action',{token_value:token,action});return page(ok?(action==='confirm'?'You’re subscribed':'You’re unsubscribed'):'Link unavailable',ok?'Your preference has been saved.':'This link has expired or is no longer available.');
 }
 if(req.method!=='POST')return json({error:'Method not allowed'},405);
 const config=await rpc('email_delivery_config');
 if(action==='webhook'){
  const body=await req.text();if(body.length>100000)return json({error:'Payload too large'},413);
  if(!config.pheelm_resend_webhook_secret||!await verifyWebhook(body,req.headers.get('svix-id')??'',req.headers.get('svix-timestamp')??'',req.headers.get('svix-signature')??'',config.pheelm_resend_webhook_secret))return json({error:'Invalid signature'},401);
  const event=JSON.parse(body);await rpc('email_record_event',{event_id:req.headers.get('svix-id'),event_type:event.type,email_id:event.data?.email_id??''});return json({ok:true});
 }
 if(action!=='process'||!config.pheelm_email_worker_secret||!await safeEqual(req.headers.get('Authorization')??'','Bearer '+config.pheelm_email_worker_secret))return json({error:'Unauthorized'},401);
 if(!config.pheelm_resend_api_key)return json({error:'Delivery not configured'},503);
 await rpc('email_prepare_digests');const jobs=await rpc('email_claim',{batch_size:20});let sent=0,failed=0;
 for(const job of jobs){try{
  const template=(templates as Record<string,{subject:string;html:string;text:string;category:string}>)[job.template];if(!template||template.category==='auth')throw new Error('Unsupported application template');
  const optional=job.category==='optional'||job.category==='marketing';if(job.category==='marketing')throw new Error('Marketing broadcasts require explicit campaign approval');
  const preferences=job.user_id?await rpc('email_job_preferences',{uid:job.user_id}):null;
  const unsub=preferences?.token?BASE+'/email?action=unsubscribe&token='+preferences.token:BASE+'/account?tab=notifications';
  const digest=job.template==='activity-digest'?await rpc('email_digest_payload',{job_id:job.id,lease_id:job.lease}):job.message;
  if(!digest){await rpc('email_complete',{job_id:job.id,lease_id:job.lease,failure:'No public additions remain',retryable:false});continue;}
  const values:Record<string,string>={MESSAGE:digest,YEAR:String(new Date().getFullYear()),ACTION_URL:actionUrl(job.action_path,BASE,endpoint),UNSUBSCRIBE_URL:unsub,POSTAL_ADDRESS:config.pheelm_postal_address??''};
  const html=template.html.replace(/\[\[([A-Z0-9_]+)\]\]/g,(_,key)=>key==='MESSAGE'?escapeHtml(values[key]??'').replaceAll('\n','<br>'):escapeHtml(values[key]??''));const text=template.text.replace(/\[\[([A-Z0-9_]+)\]\]/g,(_,key)=>values[key]??'');
  const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+config.pheelm_resend_api_key,'Content-Type':'application/json','Idempotency-Key':'pheelm-email/'+job.id},body:JSON.stringify({from:'Pheelm <notifications@pheelm.com>',reply_to:'hey@pheelm.com',to:[job.recipient],subject:template.subject,html,text,...(optional?{headers:{'List-Unsubscribe':`<${unsub}>`,'List-Unsubscribe-Post':'List-Unsubscribe=One-Click'}}:{}),tags:[{name:'template',value:job.template}]}),signal:AbortSignal.timeout(10000)});
  if(!r.ok){await rpc('email_complete',{job_id:job.id,lease_id:job.lease,failure:'Email provider HTTP '+r.status,retryable:r.status===429||r.status>=500});failed++;}else{const result=await r.json();await rpc('email_complete',{job_id:job.id,lease_id:job.lease,provider:result.id});sent++;}
 }catch{await rpc('email_complete',{job_id:job.id,lease_id:job.lease,failure:'Delivery interrupted or invalid configuration',retryable:true});failed++;}
 await new Promise(r=>setTimeout(r,550));
 }
 return json({sent,failed});
 }catch{return json({error:'Email operation unavailable'},500);}});
