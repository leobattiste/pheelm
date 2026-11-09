/** Optional one-time Auth SMTP setup. Credentials come from protected environment variables. */
import fs from 'node:fs/promises';
const token=process.env.SUPABASE_ACCESS_TOKEN,key=process.env.RESEND_API_KEY;
if(!token||!key)throw new Error('Set SUPABASE_ACCESS_TOKEN and RESEND_API_KEY in a protected local environment. Do not commit them.');
const project='mvhwfmlairwrngdttzjh';
const read=async name=>fs.readFile(new URL('../supabase/email/'+name+'.html',import.meta.url),'utf8');
const r=await fetch(`https://api.supabase.com/v1/projects/${project}/config/auth`,{method:'PATCH',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({smtp_admin_email:'notifications@pheelm.com',smtp_host:'smtp.resend.com',smtp_port:'465',smtp_user:'resend',smtp_pass:key,smtp_sender_name:'Pheelm',mailer_templates_confirmation_content:await read('confirm-signup'),mailer_templates_magic_link_content:await read('magic-link'),mailer_templates_email_change_content:await read('confirm-email-change'),mailer_subjects_confirmation:'Confirm your Pheelm email',mailer_subjects_magic_link:'Your Pheelm sign-in link',mailer_subjects_email_change:'Confirm your Pheelm email change'})});
if(!r.ok)throw new Error(`Auth SMTP configuration failed (${r.status}); inspect your access permissions.`);
console.log('Supabase Auth SMTP and signup/sign-in/email-change templates configured.');
