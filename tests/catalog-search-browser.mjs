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
 // No search bar here any more: Filters and Sort are the two controls.
 assert.equal(await page.locator('.catalog-browser input[type=search]').count(),0);
 const filtersButton=page.getByRole('button',{name:'Filters',exact:true});await filtersButton.waitFor();
 await filtersButton.click();
 const modal=page.getByRole('dialog',{name:'Filters',exact:true});
 assert.equal(await modal.getByLabel('Sort by',{exact:true}).count(),0);
 assert.equal(await modal.getByRole('button',{name:/^Show/}).count(),1);
 await modal.getByLabel('Country',{exact:true}).selectOption('US');await settledCatalog();
 await until(async()=>/Show \d+ films/.test(await modal.locator('.modal-foot').textContent()),'filtered count missing');
 await modal.getByRole('button',{name:'Close filters'}).click();
 await page.locator('.catalog-toolbar .sort-button').click();
 const sort=page.getByRole('dialog',{name:'Sort by',exact:true});
 await sort.getByRole('button').nth(1).click();await until(()=>new URL(page.url()).searchParams.has('sort'),'Films sort did not update');
 assert.equal(new URL(page.url()).searchParams.get('country'),'US');
 await page.goto(BASE+'/directors');await page.locator('.catalog-browser').waitFor();
 assert.equal(await page.locator('.catalog-browser input[type=search]').count(),0);
 const country=page.getByRole('combobox',{name:'Country',exact:true});await country.waitFor();
 await country.selectOption('US');await until(()=>new URL(page.url()).searchParams.get('country')==='US','Directors country did not update');
 await page.locator('.catalog-toolbar .sort-button').click();
 await page.getByRole('dialog',{name:'Sort by',exact:true}).getByRole('button').nth(1).click();await until(()=>new URL(page.url()).searchParams.has('sort'),'Directors sort did not update');
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
 assert.deepEqual(errors.filter(e=>!/access control checks/.test(e)),[]);console.log('PASS: Films filters and sort, Directors country and sort, no search bars, Watchlists sort, responsive layouts');
}finally{await browser.close();}
