import { NextResponse } from 'next/server';
export const dynamic='force-dynamic';
const ENDPOINT='https://mvhwfmlairwrngdttzjh.supabase.co/functions/v1/pheelm-email';
/** Public, token-scoped forms. A GET never subscribes or unsubscribes someone. */
async function handle(request:Request){
 const url=new URL(request.url),action=url.searchParams.get('action');
 if(action!=='confirm'&&action!=='unsubscribe')return new NextResponse('Not found',{status:404});
 const body=request.method==='POST'?await request.text():undefined;
 if(body&&body.length>2048)return new NextResponse('Request too large',{status:413});
 const query=new URLSearchParams({action});const token=url.searchParams.get('token');if(token&&token.length<=64)query.set('token',token);
 try{const response=await fetch(ENDPOINT+'?'+query,{method:request.method,body,headers:body?{'Content-Type':'application/x-www-form-urlencoded'}:undefined,cache:'no-store',signal:AbortSignal.timeout(15000)});
 if(!response.ok)return new NextResponse('Email settings are temporarily unavailable. Try again.',{status:503});
 const html=(await response.text()).replaceAll(`action="${ENDPOINT}?`,`action="/email?`);
 return new NextResponse(html,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'"}});
 }catch{return new NextResponse('Email settings are temporarily unavailable. Try again.',{status:503});}
}
export const GET=handle;export const POST=handle;
