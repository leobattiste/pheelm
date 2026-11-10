import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const source = readFileSync(new URL('../public/sw.js',import.meta.url),'utf8');
const handlers={};let calls=[];let stored=[];const offline={offline:true};
const cache={addAll:async()=>{},keys:async()=>[],put:async(req)=>stored.push(req.url),delete:async()=>true,match:async()=>null};
const context={URL,Promise,Set,self:{location:{origin:'https://pheelm.com'},clients:{claim:async()=>{}},skipWaiting:async()=>{},addEventListener:(n,f)=>handlers[n]=f},caches:{open:async()=>cache,keys:async()=>['pheelm-v1-pages','pheelm-v1-static','unrelated-cache'],delete:async name=>{calls.push(name);return true;},match:async name=>name==='/offline'?offline:null},fetch:async()=>({ok:true,type:'basic',redirected:false,headers:{get:()=>null},clone(){return this;}})};
vm.runInNewContext(source,context);
async function navigate(path,response){stored=[];context.fetch=async()=>{if(response instanceof Error)throw response;return response??{ok:true,type:'basic',redirected:false,headers:{get:()=>null},clone(){return this;}};};let promise;handlers.fetch({request:{method:'GET',url:'https://pheelm.com'+path,mode:'navigate',destination:'document'},respondWith:p=>promise=p,waitUntil:()=>{}});const r=await promise;await new Promise(r=>setImmediate(r));return{response:r,stored:[...stored]};}
for(const path of ['/watchlists/private','/watchlists','/c/private','/@private','/%40private','/profile','/account','/admin','/me','/notifications','/films','/directors','/?join=1']){assert.deepEqual((await navigate(path)).stored,[],`${path} must not enter the offline page cache`);assert.equal((await navigate(path,new Error('offline'))).response,offline);}
assert.deepEqual((await navigate('/legal')).stored,['https://pheelm.com/legal']);assert.deepEqual((await navigate('/about',{ok:true,type:'basic',redirected:false,headers:{get:n=>n==='cache-control'?'private, no-store':null},clone(){return this;}})).stored,[]);
let activation;handlers.activate({waitUntil:p=>activation=p});await activation;assert(calls.includes('pheelm-v1-pages'));assert(!calls.includes('unrelated-cache'));
console.log('Passed private/account/catalog pages excluded, safe public pages cached, no-store respected and stale Pheelm caches removed.');
