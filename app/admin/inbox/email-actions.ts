"use server";
import { adminClient } from '@/lib/admin';
export type ReplyState={ok:boolean;message:string}|null;
export async function replyByEmail(_previous:ReplyState,form:FormData):Promise<ReplyState>{
 const reply=String(form.get('reply')??'').trim(),id=String(form.get('message_id')??'');
 if(!/^[a-f0-9-]{36}$/i.test(id)||!reply||reply.length>5000)return{ok:false,message:'Write a reply of 1–5,000 characters.'};
 try{const db=await adminClient();const{error}=await db.rpc('email_reply_to_message',{message_id:id,reply});if(error)return{ok:false,message:'Your reply could not be queued. Try again.'};return{ok:true,message:'Your reply is queued for email delivery.'};}catch{return{ok:false,message:'Admin access is required to send replies.'};}
}
