import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
const browser=await chromium.launch(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']}:{});
const base=process.env.BASE_URL??'http://localhost:3055';
const page=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const ready=()=>page.locator('.catalog-browser[data-shuffle-ready="true"]').waitFor();
const ids=()=>page.locator('.film-grid .film-card > a').evaluateAll(els=>els.map(e=>e.getAttribute('href')));
try{
 await page.goto(base+'/films');await ready();const initial=await ids();assert.equal(initial.length,24);
 await page.getByRole('button',{name:'Load more',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('.film-grid .film-card').length===48);const expanded=await ids();assert.deepEqual(expanded.slice(0,24),initial);assert.equal(new Set(expanded).size,48);
 const link=page.locator('.film-grid .film-card > a').nth(10);await link.scrollIntoViewIfNeeded();const scroll=await page.evaluate(()=>scrollY);const destination=await link.getAttribute('href');await link.click();await page.waitForURL(base+destination);await page.goBack();await ready();await page.waitForFunction(()=>document.querySelectorAll('.film-grid .film-card').length===48);assert.deepEqual(await ids(),expanded);await page.waitForTimeout(250);assert.ok(Math.abs(await page.evaluate(()=>scrollY)-scroll)<10,'Back did not restore scroll');
 await page.reload();await ready();assert.equal((await ids()).length,24);assert.notDeepEqual(await ids(),initial,'Refresh did not reshuffle');
 const refreshed=await ids();await page.locator('.film-grid .film-card > a').first().click();await page.waitForURL(/\/films\/.+/);await page.locator('.tab-bar a[href="/films"]').evaluate(e=>e.click());await page.waitForURL(base+'/films');await ready();assert.notDeepEqual(await ids(),refreshed,'Menu navigation did not start a fresh shuffle');await page.goto(base+'/about');await page.goto(base+'/films');await ready();assert.notDeepEqual(await ids(),refreshed,'New visit did not reshuffle');
 await page.goto(base+'/films?sort=title');await ready();const sorted=await ids();await page.reload();await ready();assert.deepEqual(await ids(),sorted,'Explicit title sort changed');
 await page.goto(base+'/films?q=Moonlight');await ready();const searched=await ids();await page.reload();await ready();assert.deepEqual(await ids(),searched,'Search order changed');assert.deepEqual(errors,[]);
 console.log('PASS: refresh/new visits shuffle; Load more preserves unique order; Back restores loaded films and scroll; explicit sorting/search stay stable.');
}finally{await browser.close();}
