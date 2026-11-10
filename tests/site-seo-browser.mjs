import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import sharp from 'sharp';
const BASE=process.env.BASE_URL??'http://localhost:3000';
const SITE='https://www.pheelm.com';
const browser=await chromium.launch(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']}:{});
try{
 const context=await browser.newContext({viewport:{width:390,height:844}});
 async function html(path){const response=await context.request.get(BASE+path);assert.equal(response.status(),200,path);return response.text();}
 const canon=(source)=>source.match(/rel="canonical" href="([^"]+)"/)?.[1];
 const canonicalPaths=['/','/films','/directors','/watchlists','/about','/partnerships','/contact','/help','/legal','/donate','/newsletter','/feedback','/submit','/submit/your-film'];
 for(const path of canonicalPaths){const source=await html(path);const canonical=canon(source);assert.equal(new URL(canonical).pathname,path,path+' canonical');assert.ok(source.includes('property="og:title"'),path+' OG title');assert.ok(source.includes('name="twitter:card" content="summary_large_image"'),path+' large image');}
 const films=await html('/films'),directors=await html('/directors');
 const firstLink=(source,kind)=>[...source.matchAll(/<a\b[^>]*href="([^"]+)"/g)].map(x=>x[1]).find(path=>path.startsWith('/'+kind+'/')&&!path.includes('/page/'));
 const film=firstLink(films,'films'),director=firstLink(directors,'directors');assert.ok(film,'No server-rendered film links');assert.ok(director,'No server-rendered director links');
 for(const [source,kind]of [[films,'films'],[directors,'directors']])if(source.includes(`/${kind}/page/2`)){const second=await html(`/${kind}/page/2`);assert.ok(canon(second).endsWith(`/${kind}/page/2`));assert.ok(second.includes('Previous page'));assert.ok(firstLink(second,kind));}
 const index=await html('/sitemap.xml');assert.ok(index.includes('<sitemapindex'));
 const mapPaths=[...index.matchAll(/<loc>([^<]+)<\/loc>/g)].map(x=>new URL(x[1]).pathname);
 const entityPaths=[];
 for(const kind of ['pages','films','directors','people','profiles','watchlists']){
  const path=mapPaths.find(p=>p.endsWith('/'+kind+'-1.xml'));if(!path)continue;
  const xml=await html(path);assert.ok(xml.includes('<urlset'));const urls=[...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(x=>new URL(x[1]).pathname);assert.ok(urls.length<=1000);if(kind!=='pages')entityPaths.push(urls[0]);
 }
 for(const path of entityPaths){const source=await html(path);assert.ok(canon(source)?.endsWith(path),path+' canonical');assert.ok(!/<meta name="robots" content="[^"]*noindex/.test(source),path+' noindex');}
 for(const path of ['/opengraph-image','/api/og?page=%2Fabout',film+'/opengraph-image',director+'/opengraph-image']){
  const response=await context.request.get(BASE+path);assert.equal(response.status(),200,path);assert.match(response.headers()['content-type'],/image\/png/);const info=await sharp(await response.body()).metadata();assert.equal(info.width,1200);assert.equal(info.height,630);
 }
 assert.equal((await context.request.get(BASE+'/api/og?page=constructor')).status(),404);
 const missing=await context.request.get(BASE+'/@no_such_profile_88371');assert.ok([200,404].includes(missing.status()));const missingHtml=await missing.text();assert.ok(missingHtml.includes('noindex'));assert.ok(missingHtml.includes('Page not found')); // Next.js may stream the shell before resolving a missing profile.
 const page=await context.newPage();if(films.includes('/films/page/2')){await page.goto(BASE+'/films/page/2');for(const width of [320,390,1280]){await page.setViewportSize({width,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'catalog pagination overflow '+width);}await page.setViewportSize({width:390,height:844});}const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(BASE+'/');const link=page.locator('.row a[href^="/films/"]').first();await link.click();await page.waitForURL(/\/films\/[^/?]+/);assert.equal(new URL(page.url()).searchParams.get('join'),null);assert.deepEqual(errors,[]);
 console.log('PASS: public metadata, raw HTML catalog links, crawlable pagination, sitemap index and entity maps, canonical entity pages, uniform PNG sizes, unknown image requests, missing-profile noindex and public homepage navigation.');
}finally{await browser.close();}
