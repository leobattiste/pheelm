import fs from 'node:fs/promises';
const templates=JSON.parse(await fs.readFile(new URL('../supabase/functions/pheelm-email/templates.json',import.meta.url),'utf8'));
for(const [id,name,type] of [['sign-in','magic-link','email'],['confirm-signup','confirm-signup','email'],['confirm-email-change','confirm-email-change','email_change']]){
 const t=templates[id];let html=t.html.replaceAll('[[ACTION_URL]]',`{{ .RedirectTo }}&amp;token_hash={{ .TokenHash }}&amp;type=${type}`).replaceAll('[[MESSAGE]]',id==='sign-in'?'Use this one-time link to sign in to Pheelm. Or enter the code below on the sign-in page. Never share this code. If you did not request it, ignore this email.':id==='confirm-signup'?'Confirm your email to finish creating your Pheelm account. Or enter the code below on the sign-in page. Never share this code.':'Confirm the requested change to your Pheelm sign-in email. If you did not request this, contact hey@pheelm.com.');
 if(id!=='confirm-email-change')html=html.replace('</h1>','</h1><p style="font-family:Arial,Helvetica,sans-serif;font-size:28px;line-height:36px;color:#ffffff;letter-spacing:4px">{{ .Token }}</p>');
 await fs.writeFile(new URL('../supabase/email/'+name+'.html',import.meta.url),html);
}
console.log('Exported three Supabase Auth templates with one-time codes and destination-preserving links.');
