import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import * as jsx from 'react/jsx-runtime';
import {ImageResponse} from 'next/og.js';
import sharp from 'sharp';
const compile=path=>ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
const site={};vm.runInNewContext(compile('lib/site.ts'),{exports:site,process:{env:{}}});
const seo={};vm.runInNewContext(compile('lib/seo.ts'),{exports:seo,require:name=>{if(name==='./site')return site;throw Error(name)}});
for(const path of Object.keys(seo.PUBLIC_PAGES)){
 const meta=seo.publicPageMetadata(path);
 assert.equal(meta.alternates.canonical,path);assert.equal(meta.openGraph.url,path);assert.equal(meta.twitter.card,'summary_large_image');assert.equal(meta.openGraph.images[0].width,1200);assert.equal(meta.openGraph.images[0].height,630);assert.equal(meta.twitter.images[0].url,meta.openGraph.images[0].url);assert.ok(meta.description.length<=160);assert.equal(meta.robots.googleBot.index,true);
}
for(const title of ['Admin','Settings','Page not found']){const meta=seo.privateMetadata(title);assert.equal(meta.robots.index,false);assert.equal(meta.robots.googleBot.index,false);assert.equal(meta.alternates.canonical,null);}
const watchlinks={};vm.runInNewContext(compile('lib/watchlist-links.ts'),{exports:watchlinks});
const film={id:'f',slug:'a-film',title:'A film',credits:[{person:{id:'cast',slug:'cast-member'}},{person:{id:'director',slug:'director'}}]};
const sitemap={};vm.runInNewContext(compile('lib/seo-sitemap.ts'),{exports:sitemap,require:name=>{
 if(name==='./seo')return seo;if(name==='./supabase/config')return{SITE_URL:'https://www.pheelm.com'};if(name==='./watchlist-links')return watchlinks;
 if(name==='./data')return{getFilms:async()=>Array.from({length:30},(_,i)=>({...film,id:'f'+i,slug:'film-'+i})),getDirectors:async()=>[{id:'director',slug:'director'}]};
 if(name==='./community')return{getPublicProfileHandles:async()=>['public_member']};
 if(name==='./watchlists')return{getPublicWatchlists:async()=>[{id:'w',slug:'a-watchlist',updated_at:'2026-11-10T00:00:00Z'}]};throw Error(name);
}});
const entries=await sitemap.sitemapEntries();assert.equal(entries.films.length,30);assert.equal(entries.people.length,1);assert.equal(entries.people[0].path,'/people/cast-member');assert.ok(entries.pages.some(e=>e.path==='/films/page/2'));assert.equal(entries.profiles[0].path,'/@public_member');assert.equal(entries.watchlists[0].path,'/watchlists/a-watchlist');assert.ok(!sitemap.sitemapXml([{path:'/x?q=a&b=<x>'}]).includes('b=<x>'));assert.equal(sitemap.SITEMAP_CHUNK,1000);
const fonts=[{name:'Inter',data:fs.readFileSync('assets/fonts/Inter-Regular.woff'),weight:400,style:'normal'},{name:'Inter',data:fs.readFileSync('assets/fonts/Inter-Bold.woff'),weight:700,style:'normal'}];
let fetches=0;const picture=await sharp({create:{width:20,height:30,channels:3,background:'#46717a'}}).png().toBuffer();
const images={};vm.runInNewContext(compile('lib/share-image.tsx'),{exports:images,Buffer,URL,AbortSignal,fetch:async()=>{fetches++;return new Response(picture,{headers:{'content-type':'image/png'}})},require:name=>{
 if(name==='react/jsx-runtime')return jsx;if(name==='next/og')return{ImageResponse};if(name==='sharp')return sharp;if(name==='./seo')return seo;if(name==='./supabase/config')return{SUPABASE_URL:'https://project.supabase.co'};if(name==='./og')return{ogFonts:async()=>fonts,OgWordmark:()=>React.createElement('div',{style:{display:'flex'}},'pheelm')};throw Error(name);
}});
for(const input of [{title:'A film',label:'Film',image:'https://image.tmdb.org/t/p/w500/a.jpg'},{title:'Long title '.repeat(25),label:'Watchlist',description:'Long bio '.repeat(100),private:true},{title:'Profile',label:'Member',image:'https://127.0.0.1/internal'}]){
 const response=await images.shareImage(input);const data=Buffer.from(await response.arrayBuffer());const metadata=await sharp(data).metadata();assert.equal(metadata.width,1200);assert.equal(metadata.height,630);assert.match(response.headers.get('content-type'),/image\/png/);if(input.private)assert.match(response.headers.get('cache-control'),/no-store/);
}
assert.equal(fetches,1,'Unapproved image URL was fetched');
console.log('PASS: all public canonical/OG/Twitter metadata; private noindex overrides; full catalog and deduplicated cast sitemaps; crawlable page discovery; XML escaping; shared 1200×630 image renderer, long titles, missing art, private cache rules and safe image hosts.');
