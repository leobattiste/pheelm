// A poster that can't be fetched must fall back to the film's title card, never an empty box.
import {build} from 'esbuild';
import {chromium} from 'playwright-core';
import fs from 'node:fs';
import assert from 'node:assert/strict';

const bundle=await build({stdin:{contents:`import React from'react';import{createRoot}from'react-dom/client';import Poster from'./components/Poster';import {useState} from'react';
const films=[{title:'Working Poster',src:'/good.svg'},{title:'Missing Poster',src:'/gone.svg'},{title:'No Poster At All',src:null}];
function Swappable(){const[src,setSrc]=useState('/gone.svg');
 window.replacePoster=()=>setSrc('/good.svg');
 return <li className="film-card" id="swappable"><Poster title="Replaced Poster" year={2021} directors={['A Director']} src={src} priority/></li>;}
createRoot(document.getElementById('root')).render(<ul className="film-grid">{films.map(f=><li key={f.title} className="film-card"><Poster title={f.title} year={2020} directors={['A Director']} src={f.src} priority/></li>)}<Swappable/></ul>);`,
 loader:'tsx',resolveDir:process.cwd()},bundle:true,write:false,format:'iife',platform:'browser',outdir:'/tmp/poster-fallback-test',define:{'process.env':'{}'}});

const browser=await chromium.launch(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']}:{});
try{
 const page=await browser.newPage({viewport:{width:390,height:844}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
// Playwright tries the most recently added route first, so the page itself goes in before the images.
 await page.route('https://pheelm.test/**',r=>r.fulfill({contentType:'text/html',body:'<html data-theme="dark" data-grid="large"><body><main class="page" id="root"></main></body></html>'}));
 await page.route('https://pheelm.test/good.svg',r=>r.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="600" height="900"><rect width="600" height="900" fill="#7a3b2e"/></svg>'}));
 await page.route('https://pheelm.test/gone.svg',r=>r.abort());
 await page.goto('https://pheelm.test/films');
 await page.addStyleTag({content:fs.readFileSync('app/globals.css','utf8')});
 await page.addScriptTag({content:bundle.outputFiles.find(f=>f.path.endsWith('.js')).text});
 await page.locator('.film-card').first().waitFor();
 await page.waitForFunction(()=>document.querySelectorAll('.poster-card').length===3,null,{timeout:10000});

 // The one that loads stays an image, and it is visible.
 const shown=page.locator('.film-card:not(#swappable) .poster img');
 assert.equal(await shown.count(),1,'only the working poster stays an image');
 // It fades in, so give the animation its moment before checking it ends up fully visible.
 await page.waitForFunction(()=>+getComputedStyle(document.querySelector('.poster img')).opacity===1,null,{timeout:5000});
 const look=await shown.evaluate(i=>({opacity:+getComputedStyle(i).opacity,width:i.getBoundingClientRect().width,natural:i.naturalWidth}));
 assert.ok(look.width>0&&look.natural>0,'a loaded poster has size: '+JSON.stringify(look));

 // The missing one and the one with no URL both read as title cards.
 const titles=await page.locator('.poster-card .poster-card-title').allTextContents();
 assert.deepEqual(titles,['Missing Poster','No Poster At All','Replaced Poster'],'a poster that fails shows its title instead');

 // A replacement image must be tried again, not hidden behind the earlier failure.
 await page.evaluate(()=>window.replacePoster());
 await page.waitForFunction(()=>!!document.querySelector('#swappable .poster img'),null,{timeout:5000});
 const replaced=page.locator('#swappable .poster img');
 await page.waitForFunction(()=>{const i=document.querySelector('#swappable .poster img');return i&&i.naturalWidth>0;},null,{timeout:5000});
 assert.equal(await replaced.evaluate(i=>i.naturalWidth>0),true,'a new URL replaces the title card');
 assert.deepEqual(errors,[]);
 console.log('PASS: loaded posters are visible; a failed or missing poster falls back to the title card; a replacement URL is tried afresh');
}finally{await browser.close();}
