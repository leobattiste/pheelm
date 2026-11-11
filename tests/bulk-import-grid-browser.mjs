import {build} from 'esbuild';
import {chromium} from 'playwright-core';
import fs from 'node:fs';
import assert from 'node:assert/strict';

const bundle = await build({stdin:{contents:`
import React from 'react';import{createRoot}from'react-dom/client';
import{AdminSelectionBar}from'./app/admin/AdminSelectionBar';
import GridToggle from './components/GridToggle';import{themeScript}from'./lib/theme';
window.applyPreferences=()=>Function(themeScript)();window.applyPreferences();
const ids=Array.from({length:7},(_,i)=>'11111111-1111-4111-8111-'+String(i).padStart(12,'0'));
createRoot(document.getElementById('root')).render(<><GridToggle/><form><AdminSelectionBar selected={ids} onClear={()=>{}} entity="films" canDelete hasFeatured/></form></>);
`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,format:'iife',platform:'browser',tsconfig:'tsconfig.json',plugins:[{name:'mock',setup(b){
  b.onResolve({filter:/^next\/navigation$/},()=>({path:'nav',namespace:'mock'}));
  b.onResolve({filter:/import-selected$/},()=>({path:'import',namespace:'mock'}));
  b.onLoad({filter:/.*/,namespace:'mock'},({path})=>({contents:path==='nav'?`export const useSearchParams=()=>new URLSearchParams();export const useRouter=()=>({refresh:()=>window.refreshed=true});`:`
  export const importSelectedFromTmdb=async(entity,ids)=>{
    window.batches??=[];window.batches.push([...ids]);
    if(window.pause)await new Promise(resolve=>window.finishBatch=resolve);
    return ids.map(id=>({id,ok:!(window.fail&&id.endsWith('000001')),message:id.endsWith('000001')&&window.fail?'Failed match':'Imported '+id}));
  };`,loader:'js'}));
}}]});
const browser=await chromium.launch(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']}:{});
try {
  const page=await browser.newPage({viewport:{width:390,height:844}});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.route('http://pheelm.test/**',route=>route.fulfill({contentType:'text/html',body:'<html data-theme="dark"><body><div id="root"></div></body></html>'}));
  await page.goto('http://pheelm.test/admin/films');
  await page.evaluate(()=>{localStorage.setItem('grid','list');window.fail=true;});
  await page.addStyleTag({content:fs.readFileSync('app/globals.css','utf8')+'\n'+fs.readFileSync('app/admin/admin-browser.css','utf8')});
  await page.addScriptTag({content:bundle.outputFiles[0].text});
  await page.getByRole('radio',{name:'One per row'}).waitFor();
  assert.equal(await page.locator('html').getAttribute('data-grid'),'large','old preference overrode the new large default');
  assert.equal(await page.getByRole('radio',{name:'One per row'}).getAttribute('aria-checked'),'true');
  for(const [label,value] of [['Two per row','small'],['List','list'],['One per row','large']]) {
    await page.getByRole('radio',{name:label,exact:true}).click();
    await page.evaluate(()=>{document.documentElement.dataset.grid='invalid';window.applyPreferences();});
    assert.equal(await page.locator('html').getAttribute('data-grid'),value,'new explicit preference not remembered');
  }
  await page.evaluate(()=>{localStorage.setItem('pheelm:grid:v2','invalid');window.applyPreferences();});
  assert.equal(await page.locator('html').getAttribute('data-grid'),'large');
  await page.getByRole('button',{name:'Import from TMDB',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Import from TMDB',exact:true});
  assert.equal(await page.evaluate(()=>window.batches),undefined,'import ran before confirmation');
  await dialog.getByRole('button',{name:'Import 7',exact:true}).click();
  await page.getByRole('status').filter({hasText:'Import complete: 7 of 7'}).waitFor();
  assert.deepEqual(await page.evaluate(()=>window.batches.map(batch=>batch.length)),[3,3,1]);
  assert.match(await page.getByRole('status').textContent(),/6 succeeded; 1 failed/);
  await page.evaluate(()=>window.fail=false);
  await page.getByRole('button',{name:'Retry failed imports'}).click();
  await page.getByRole('status').filter({hasText:'Import complete: 1 of 1'}).waitFor();
  assert.equal((await page.evaluate(()=>window.batches.at(-1))).length,1);
  await page.evaluate(()=>{window.pause=true;window.batches=[];});
  await page.getByRole('button',{name:'Import from TMDB',exact:true}).click();
  await dialog.getByRole('button',{name:'Import 7',exact:true}).click();
  await page.getByRole('button',{name:'Stop after this batch',exact:true}).click();
  assert.equal(await page.getByRole('button',{name:'Publish',exact:true}).isDisabled(),true);
  await page.evaluate(()=>window.finishBatch());
  await page.getByRole('status').filter({hasText:'Import stopped: 3 of 7'}).waitFor();
  assert.equal(await page.evaluate(()=>window.batches.length),1);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'mobile horizontal overflow');
  assert.equal(await page.evaluate(()=>window.refreshed),true);
  assert.deepEqual(errors,[]);
  console.log('PASS: large-grid default and saved choices; confirmed batched imports, isolated failures, retry, stop, refresh and mobile width.');
} finally {await browser.close();}
