import {build} from 'esbuild';
import {chromium} from 'playwright-core';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const bundle=await build({stdin:{contents:`import React from'react';import{createRoot}from'react-dom/client';import Browser from'./components/FilmBrowser';import Popular from'./app/films/PopularFilms';const films=Array.from({length:12},(_,i)=>({id:String(i),tmdb_id:i+1,status:'published',slug:'film-'+i,title:'Film '+i,year:2000+i,type:'feature',countries:['US'],languages:['English'],genres:['Drama'],runtime:90,poster_url:null,color:null,credits:[],directors:[{name:'Director'}],awards:[],watch:[]}));const entries=films.map(f=>({...f,image:null,subtitle:'',aliases:[],names:['Director'],types:['feature'],years:[f.year],wins:0,nominations:0,availability:[],added:0,count:1,filmography:[],film:{...f,directors:['Director'],wins:0}}));Popular({films}).then(popular=>createRoot(document.getElementById('root')).render(<Browser entries={entries} afterSearch={popular}/>));`,loader:'tsx',resolveDir:process.cwd()},bundle:true,write:false,format:'iife',platform:'browser',outdir:'/tmp/films-popular-test',define:{'process.env':'{}'},plugins:[{name:'fixtures',setup(b){
 b.onResolve({filter:/^next\/navigation$/},()=>({path:'navigation',namespace:'fixture'}));
 b.onResolve({filter:/^next\/link$/},()=>({path:'link',namespace:'fixture'}));
 b.onResolve({filter:/^@\/lib\/data$/},()=>({path:'data',namespace:'fixture'}));
 b.onResolve({filter:/^@\/lib\/film-popularity$/},()=>({path:'popularity',namespace:'fixture'}));
 b.onResolve({filter:/supabase\/client$/},()=>({path:'client',namespace:'fixture'}));
 b.onResolve({filter:/SignInSheet$/},()=>({path:'signin',namespace:'fixture'}));
 b.onResolve({filter:/^next\/cache$/},()=>({path:'cache',namespace:'fixture'}));
 b.onResolve({filter:/^server-only$/},()=>({path:'empty',namespace:'fixture'}));
 b.onLoad({filter:/.*/,namespace:'fixture'},({path})=>({loader:'jsx',resolveDir:process.cwd(),contents:{navigation:`export const usePathname=()=>'/films';export const useSearchParams=()=>new URLSearchParams();export const useRouter=()=>({push(){}});`,link:`import React from'react';export default function Link({href,children,...p}){return <a href={href} {...p}>{children}</a>}`,data:`export const toCard=f=>({...f,directors:f.directors.map(d=>d.name),wins:0});`,popularity:`export{rankPopularFilms}from'./lib/film-popularity';export const getPopularMovieIds=async()=>[12,11,10,9,8,7,6,5,4,3,2,1];`,cache:`export const unstable_cache=f=>f;`,empty:'',client:`export const getBrowserClient=()=>null;`,signin:`export const openSignIn=()=>false;`}[path]}));
}}]});
const browser=await chromium.launch(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']}:{});
try{for(const width of [320,390,1440])for(const theme of ['dark','light']){
 const page=await browser.newPage({viewport:{width,height:900},reducedMotion:'reduce'});const errors=[];page.on('pageerror',e=>{errors.push(e.message);console.error(e.message);});
 await page.route('https://pheelm.test/**',r=>r.fulfill({contentType:'text/html',body:`<html data-theme="${theme}" data-chrome="app"><body><main class="page" id="root"></main></body></html>`}));await page.goto('https://pheelm.test/films');
 await page.addStyleTag({content:fs.readFileSync('app/globals.css','utf8')+'\n'+bundle.outputFiles.find(f=>f.path.endsWith('.css')).text});await page.addScriptTag({content:bundle.outputFiles.find(f=>f.path.endsWith('.js')).text});
 await page.getByRole('heading',{name:'Popular',exact:true}).waitFor();const row=page.locator('.row');
 const search=await page.locator('.catalog-toolbar').boundingBox(),popular=await row.boundingBox(),grid=await page.locator('.film-grid').boundingBox();assert(popular.y>=search.y+search.height);assert(grid.y>=popular.y+popular.height);
 assert.equal(await row.locator('.film-card-title').first().textContent(),'Film 11');assert.equal(await row.locator('.film-card > a').first().getAttribute('href'),'/films/film-11');
 if(width>=900){await page.getByRole('button',{name:'Scroll Popular forward'}).click();await page.waitForFunction(()=>document.querySelector('.row-track').scrollLeft>0);}else{await row.locator('.row-track').evaluate(e=>e.scrollLeft=180);assert(await row.locator('.row-track').evaluate(e=>e.scrollLeft>0));}
 await page.locator('.search-bar input').fill('Film 11');await page.waitForFunction(()=>document.querySelectorAll('.film-grid .film-card').length===1);assert.equal(await row.locator('.film-card').count(),12);
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);await page.close();
}console.log('PASS: Popular under search, worldwide order, film links, scrolling, independent search and responsive themes');}finally{await browser.close();}
