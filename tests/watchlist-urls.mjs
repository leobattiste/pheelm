import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const compile=file=>ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
const links={};vm.runInNewContext(compile('lib/watchlist-links.ts'),{exports:links});
const list={id:'00000000-0000-0000-0000-000000000001',slug:'weekend-films',title:'Weekend films',description:'A curated selection.',is_public:true,hidden:false};
assert.equal(links.watchlistPath(list),'/watchlists/weekend-films');
assert.equal(links.watchlistPath({id:list.id}),'/c/'+list.id);
const meta=links.watchlistMetadata(list);
assert.equal(meta.alternates.canonical,'/watchlists/weekend-films');assert.equal(meta.openGraph.url,meta.alternates.canonical);assert.equal(meta.twitter.images[0].url,meta.openGraph.images[0].url);assert.equal(meta.description,list.description);assert.equal(meta.robots.index,true);
assert.ok(links.watchlistMetadata({...list,description:'x'.repeat(500)}).description.length<=160);
for(const privateList of [null,{...list,is_public:false},{...list,hidden:true}]){
 const data=links.watchlistMetadata(privateList);assert.equal(data.robots.index,false);assert.equal(data.robots.googleBot.index,false);assert.ok(!JSON.stringify(data).includes(list.description));assert.ok(!JSON.stringify(data).includes(list.title));
}
let visible=list,queried=[];
const db={from:()=>({select:()=>({eq:(key,value)=>{queried.push([key,value]);return{maybeSingle:async()=>({data:visible,error:null})};}})})};
const data={};vm.runInNewContext(compile('lib/watchlists.ts'),{exports:data,require:name=>{
 if(name==='react')return{cache:fn=>fn};if(name==='./supabase/server')return{getServerClient:async()=>db};if(name==='./supabase/config')return{};if(name==='@supabase/supabase-js')return{};throw Error(name);
}});
assert.equal((await data.getWatchlist(list.slug)).id,list.id);assert.equal(queried[0][0],'slug');assert.equal(queried[0][1],list.slug);
visible=null;assert.equal(await data.getWatchlist(list.slug),null,'RLS-inaccessible list must stay missing');
queried=[];for(const invalid of ['../secret','hello/world','%2f','A Name','x'.repeat(121)])assert.equal(await data.getWatchlist(invalid),null);assert.equal(queried.length,0);
const legacy={};vm.runInNewContext(compile('app/c/[id]/page.tsx'),{exports:legacy,URLSearchParams,require:name=>{
 if(name==='next/navigation')return{notFound:()=>{throw Error('NOT_FOUND')},permanentRedirect:path=>{throw Error('REDIRECT:'+path)}};
 if(name==='@/lib/supabase/server')return{getServerClient:async()=>db};if(name==='@/lib/watchlist-links')return links;throw Error(name);
}});
visible=list;
await assert.rejects(legacy.default({params:Promise.resolve({id:list.id}),searchParams:Promise.resolve({people:'',error:'description'})}),/REDIRECT:\/watchlists\/weekend-films\?people=&error=description/);
visible=null;await assert.rejects(legacy.default({params:Promise.resolve({id:list.id}),searchParams:Promise.resolve({})}),/NOT_FOUND/);
console.log('PASS: canonical watchlist URLs, matching metadata/share previews, private noindex without content leaks, validated slug lookups, RLS access and permanent legacy redirects preserving query parameters.');
