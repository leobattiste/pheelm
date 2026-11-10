"use client";
import { useSyncExternalStore } from 'react';
import { getBrowserClient } from './supabase/client';
let email: string | null = null;
let generation = 0;
let stop: (()=>void) | undefined;
const listeners = new Set<()=>void>();
function publish(value:string|null){if(email===value)return;email=value;listeners.forEach(listener=>listener());}
function subscribe(listener:()=>void){
 listeners.add(listener);
 if(listeners.size===1){
  const db=getBrowserClient();
  if(db){const sequence=++generation;const {data}=db.auth.onAuthStateChange((_event,session)=>{generation++;publish(session?.user.email??null);});stop=()=>data.subscription.unsubscribe();void db.auth.getSession().then(({data,error})=>{if(sequence===generation)publish(error?null:data.session?.user.email??null);}).catch(()=>{if(sequence===generation)publish(null);});}
 }
 return()=>{listeners.delete(listener);if(!listeners.size){generation++;stop?.();stop=undefined;email=null;}};
}
/** Display convenience only; server actions still authenticate all account changes. */
export const useSessionEmail=()=>useSyncExternalStore(subscribe,()=>email,()=>null);
