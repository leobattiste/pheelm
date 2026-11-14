import {build} from 'esbuild';
import {chromium} from 'playwright-core';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const bundle=await build({stdin:{contents:`import React from 'react';import{createRoot}from'react-dom/client';import Tabs from './components/Tabs';import Admin from './app/admin/AdminNav';import Submission from './components/SubmissionNav';const tabs=[{id:'first',label:'Watchlist',icon:'stack',panel:<p>Watchlist panel</p>},{id:'second',label:'Following',icon:'users2',panel:<p>Following panel</p>},{id:'third',label:'About this member',icon:'user',panel:<p>About panel</p>}];createRoot(document.getElementById('root')).render(<><div style={{height:250}}/><section id="content-tabs"><Tabs tabs={tabs}/></section><section id="settings-tabs" className="account-page"><Tabs showIcons tabs={tabs.map(t=>({...t,id:'settings-'+t.id}))}/></section><Admin/><Submission/><div style={{height:2000}}/></>);`,resolveDir:process.cwd(),loader:'tsx'},define:{'process.env':'{}'},bundle:true,write:false,format:'iife',platform:'browser',tsconfig:'tsconfig.json',plugins:[{name:'routing',setup(b){b.onResolve({filter:/^next\/navigation$/},()=>({path:'navigation',namespace:'mock'}));b.onResolve({filter:/^next\/link$/},()=>({path:'link',namespace:'mock'}));b.onLoad({filter:/.*/,namespace:'mock'},({path})=>({contents:path==='navigation'?`export const usePathname=()=>'/admin/films';`:`import React from 'react';export default React.forwardRef(({href,children,prefetch,scroll,replace,...props},ref)=><a ref={ref} href={href} {...props}>{children}</a>);`,loader:'jsx',resolveDir:process.cwd()}));}}]});
const browser=await chromium.launch(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']}:{});
try{
 const page=await browser.newPage({viewport:{width:320,height:844},reducedMotion:'reduce'});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('http://pheelm.test/**',route=>route.fulfill({contentType:'text/html',body:'<html data-theme="dark"><body><main style="padding:17px"><div id="root"></div></main></body></html>'}));await page.goto('http://pheelm.test/tabs');await page.addStyleTag({content:fs.readFileSync('app/globals.css','utf8')});await page.addScriptTag({content:bundle.outputFiles[0].text});
 const strip=page.locator('#content-tabs [role=tablist]');await strip.waitFor();
 assert.equal(await page.locator('#content-tabs [role=tab] svg').count(),0);assert.equal(await page.locator('#settings-tabs [role=tab] svg').count(),3);assert.equal(await page.locator('.admin-navigation svg,.submission-tabs svg').count(),0);
 for(const width of [320,390,1440]){
  await page.setViewportSize({width,height:844});await page.evaluate(()=>window.scrollTo(0,100));
  const tab=strip.getByRole('tab',{name:'Watchlist',exact:true});await tab.evaluate(e=>e.focus({preventScroll:true}));
  const before=await strip.boundingBox(),scroll=await page.evaluate(()=>scrollY);
  await tab.hover();await page.mouse.down();const pressed=await tab.boundingBox();assert.equal(await tab.evaluate(e=>getComputedStyle(e).transform),'none');assert.ok(Math.abs(pressed.y-before.y)<1);assert.equal(Math.round(pressed.height),55);await page.mouse.up();
  await tab.press('End');await page.getByRole('tabpanel',{name:'About this member',exact:true}).waitFor();
  const after=await strip.boundingBox();assert.ok(Math.abs(after.y-before.y)<1);assert.equal(await page.evaluate(()=>scrollY),scroll);
  assert.ok(await strip.getByRole('tab',{name:'About this member',exact:true}).evaluate(e=>{const item=e.getBoundingClientRect(),parent=e.parentElement.getBoundingClientRect();return item.left>=parent.left-1&&item.right<=parent.right+1;}));
  await strip.getByRole('tab',{name:'About this member',exact:true}).press('Home');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 }
 assert.deepEqual(errors,[]);console.log('PASS: text-only content/admin/submission tabs, Settings icons, stable tab alignment while pressed, keyboard navigation without vertical scrolling, and horizontal reachability at 320–1440px.');
}finally{await browser.close();}
