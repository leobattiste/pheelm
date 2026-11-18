import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import vm from 'node:vm';
const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/search-discovery.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports,Date,Map});
const films=exports.RECOGNIZED_FILMS.map((slug,i)=>({id:String(i),slug,status:'published'}));
const monday=new Date('2026-11-16T00:00:00Z');
const ids=x=>Array.from(x,f=>f.id);
assert.equal(exports.weeklyPopular(films,monday).length,12);
assert.deepEqual(ids(exports.weeklyPopular(films,monday)),ids(exports.weeklyPopular(films,new Date('2026-11-22T23:59:59Z'))));
for(let i=0;i<100;i++){const a=exports.weeklyPopular(films,new Date(+monday+i*604800000));const b=exports.weeklyPopular(films,new Date(+monday+(i+1)*604800000));assert.equal(new Set(a.map(f=>f.id).filter(id=>b.some(f=>f.id===id))).size,0);}
assert.ok(exports.weeklyPopular(films.map(f=>({...f,status:'draft'})),monday).length===0);
assert.equal(exports.weeklyPopular(films.slice(0,5),monday).length,5);
assert.equal(exports.recentlyAdded([{id:'a',title:'A',added:1},{id:'b',title:'B',added:9}])[0].id,'b');
console.log('PASS: Monday UTC boundary, stable weekly selection, 100 adjacent rotations without repeats, published-only pool, sparse catalogs and publication order');
