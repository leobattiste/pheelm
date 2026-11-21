import assert from 'node:assert/strict';
import { chromium, webkit } from 'playwright-core';
const BASE=process.env.BASE_URL??'http://localhost:3001';
const browser=await (process.env.BROWSER === 'webkit' ? webkit : chromium).launch(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']} : {});
const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,reducedMotion:'reduce'});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
async function until(fn,message){for(let i=0;i<80;i++){if(await fn())return;await page.waitForTimeout(100);}throw Error(message);}
// URL/chips update before useDeferredValue finishes rendering the matching cards.
const settledCatalog=()=>page.locator('.catalog-browser[aria-busy="false"]').waitFor();
try{
 await page.waitForLoadState('networkidle');await page.goto(BASE+'/films');await page.locator('.catalog-browser').waitFor();
 // A search bar, and one Filters button holding the sort and every filter.
 const filmSearch=page.locator('.catalog-browser input[type=search]');await filmSearch.waitFor();
 assert.equal(await page.locator('.catalog-pills').count(),0,'filters belong in the modal');
 await page.getByRole('button',{name:'Filters',exact:true}).click();
 const filmModal=page.getByRole('dialog',{name:'Filters',exact:true});
 for(const label of ['Sort by','Genre','Type','Country','Decade','Language','Where to watch'])assert.equal(await filmModal.getByLabel(label,{exact:true}).count(),1,label+' missing');
 await filmModal.getByLabel('Country',{exact:true}).selectOption('US');await settledCatalog();
 await until(()=>new URL(page.url()).searchParams.get('country')==='US','Films country did not update');
 await filmModal.getByLabel('Sort by',{exact:true}).selectOption('title');await until(()=>new URL(page.url()).searchParams.get('sort')==='title','Films sort did not update');
 assert.equal(new URL(page.url()).searchParams.get('country'),'US');
 await filmModal.getByRole('button',{name:'Close filters'}).click();
 assert.equal(await page.locator('.catalog-active-filters .chip').count(),1,'the chosen filter shows as a chip');
 // The bar searches, suggests and remembers.
 await page.goto(BASE+'/films');await filmSearch.fill('a');await settledCatalog();
 await until(async()=>await page.locator('.catalog-suggestions [role=option]').count()>0,'no suggestions');
 const first=page.locator('.catalog-suggestions [role=option] a').first();const target=await first.getAttribute('href');
 assert.ok(/^\/films\//.test(target),'suggestions open a film: '+target);
 await filmSearch.press('Enter');await settledCatalog();
 await until(()=>new URL(page.url()).searchParams.get('q')==='a','the query is kept in the address');
 await page.locator('.catalog-clear-query').click();await settledCatalog();
 await filmSearch.click();
 await until(async()=>await page.getByRole('button',{name:'Clear history'}).count()>0,'recent searches are not offered');
 await page.getByRole('button',{name:'Clear history'}).click();
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'the toolbar overflows the page');
 await page.goto(BASE+'/directors');await page.locator('.catalog-browser').waitFor();
 assert.equal(await page.locator('.catalog-browser input[type=search]').count(),1,'Directors has a search bar too');
 // All / Featured / Following live in the Filters window, not under the search bar.
 assert.equal(await page.locator('.catalog-browser > .feed-tabs').count(),0,'the feed buttons should not sit under the search bar');
 await page.getByRole('button',{name:'Filters',exact:true}).click();
 const dirModal=page.getByRole('dialog',{name:'Filters',exact:true});
 for(const name of ['All','Featured','Following'])assert.equal(await dirModal.getByRole('group',{name:'Show'}).getByRole('button',{name,exact:true}).count(),1,name+' missing from Filters');
 await dirModal.getByRole('group',{name:'Show'}).getByRole('button',{name:'Featured',exact:true}).click();await until(()=>new URL(page.url()).searchParams.get('feed')==='featured','Directors feed did not update');
 assert.equal(await dirModal.getByRole('button',{name:'Featured',exact:true}).getAttribute('aria-pressed'),'true');
 for(const label of ['Sort by','Country','Decade','Type','Films in the directory'])assert.equal(await dirModal.getByLabel(label,{exact:true}).count(),1,label+' missing');
 await dirModal.getByLabel('Country',{exact:true}).selectOption('US');await until(()=>new URL(page.url()).searchParams.get('country')==='US','Directors country did not update');
 assert.equal(new URL(page.url()).searchParams.get('feed'),'featured');
 await dirModal.getByLabel('Sort by',{exact:true}).selectOption('az');await until(()=>new URL(page.url()).searchParams.get('sort')==='az','Directors sort did not update');
 await dirModal.getByRole('button',{name:'Close filters'}).click();
 // The chosen feed shows as a removable chip beside the other filters, and the button counts it.
 await page.getByRole('button',{name:'Remove Featured',exact:true}).waitFor();
 assert.equal(await page.locator('.filter-button .badge').textContent(),'2');
 assert.equal(await page.locator('.director-card .portrait').first().evaluate(e=>getComputedStyle(e).borderRadius),'8px');
 await page.setViewportSize({width:1440,height:1000});await page.goto(BASE+'/films');await page.locator('.catalog-browser').waitFor();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));
 await page.setViewportSize({width:390,height:844});await page.goto(BASE+'/watchlists?feed=featured');
 await page.getByRole('heading',{name:'Watchlists',exact:true}).waitFor();
 assert.equal(await page.getByRole('button',{name:'Following',exact:true}).locator('svg').count(),0);
 await page.locator('.collections-toolbar .filter-button').click();
 const sortModal=page.getByRole('dialog',{name:'Sort by',exact:true});
 for(const button of await sortModal.locator('.chip-row button').all()){
  const selected=await button.getAttribute('aria-pressed')==='true';
  const style=await button.evaluate(e=>({background:getComputedStyle(e).backgroundColor,blur:getComputedStyle(e).backdropFilter}));
  if(selected){assert.notEqual(style.background,'rgba(0, 0, 0, 0)');assert.equal(style.blur,'none');}
  else{assert.equal(style.blur,'none');}
 }
 await sortModal.getByRole('button',{name:'New',exact:true}).click();
 await until(()=>new URL(page.url()).searchParams.get('sort')==='new','Watchlists sort did not update');
 assert.equal(new URL(page.url()).searchParams.get('feed'),'featured');
 const legacy=await page.request.get(BASE+'/collections?feed=featured&sort=new',{maxRedirects:0});
 assert.equal(legacy.status(),308);assert.equal(legacy.headers().location,'/watchlists?feed=featured&sort=new');
 assert.deepEqual(errors.filter(e=>!/access control checks/.test(e)),[]);console.log('PASS: Films and Directors search bars with suggestions and history, every filter in the Filters modal, Directors feeds, Watchlists sort, responsive layouts');
}finally{await browser.close();}
