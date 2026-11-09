export const escapeHtml = (value: string) => value.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function actionUrl(path: string, base: string, endpoint: string): string {
 if(path.startsWith('/newsletter-confirm?token='))return base+'/email?action=confirm&token='+encodeURIComponent(path.split('token=')[1]);
 if(!path.startsWith('/')||path.startsWith('//')||path.includes('\\'))throw new Error('Invalid action path');
 const url=new URL(path,base);if(url.origin!==new URL(base).origin)throw new Error('Invalid origin');return url.href;
}
export async function safeEqual(a: string,b: string){const enc=new TextEncoder();const [x,y]=await Promise.all([crypto.subtle.digest('SHA-256',enc.encode(a)),crypto.subtle.digest('SHA-256',enc.encode(b))]);return new Uint8Array(x).every((v,i)=>v===new Uint8Array(y)[i]);}
export async function verifyWebhook(body: string,id: string,timestamp: string,signature: string,secret: string,now=Date.now()){
 if(!id||!timestamp||!/^\d+$/.test(timestamp)||Math.abs(now/1000-Number(timestamp))>300)return false;
 try{const raw=secret.startsWith('whsec_')?secret.slice(6):secret;const bytes=Uint8Array.from(atob(raw),c=>c.charCodeAt(0));const key=await crypto.subtle.importKey('raw',bytes,{name:'HMAC',hash:'SHA-256'},false,['sign']);const signed=await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(`${id}.${timestamp}.${body}`));const expected=btoa(String.fromCharCode(...new Uint8Array(signed)));for(const part of signature.split(' '))if(part.startsWith('v1,')&&await safeEqual(part.slice(3),expected))return true;return false;}catch{return false;}
}
