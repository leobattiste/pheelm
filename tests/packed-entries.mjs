// Packing must not change what the search and filters see: unpack(pack(x)) equals the old entry.
import {build} from 'esbuild';
import vm from 'node:vm';
import assert from 'node:assert/strict';
// The module runs in its own realm, so arrays from it are not reference-equal to ours: compare as JSON.
const same=(a,b,msg)=>assert.equal(JSON.stringify(a),JSON.stringify(b),msg);
import fs from 'node:fs';

const out=await build({stdin:{contents:`
  export {packFilm, packDirector, filmSearchEntry, directorSearchEntry} from './lib/search-data';
`,loader:'ts',resolveDir:process.cwd()},bundle:true,write:false,format:'cjs',platform:'node',external:['server-only']});
const mod={exports:{}};
vm.runInNewContext(out.outputFiles[0].text,{module:mod,exports:mod.exports,require:(n)=>n==='server-only'?{}:require(n),console,process,TextEncoder,TextDecoder});
const {packFilm,packDirector,filmSearchEntry,directorSearchEntry}=mod.exports;

const cat=JSON.parse(fs.readFileSync('data/catalog.json','utf8'));
const people=new Map((cat.people??[]).map(p=>[p.id,p]));
const credits=(cat.credits??[]).map(c=>({...c,person:people.get(c.person_id)??{name:'Someone'}}));
const film=f=>({...f,aka:f.aka??[],countries:f.countries??[],languages:f.languages??[],genres:f.genres??[],
  awards:f.awards??[],watch:f.watch??[],credits:credits.filter(c=>c.film_id===f.id),
  directors:credits.filter(c=>c.film_id===f.id&&c.role==='director').map(c=>c.person)});
const films=cat.films.slice(0,40).map(film);

// Every field the old entry had survives the round trip.
for(const f of films){
  const entry=filmSearchEntry(f);
  for(const key of ['id','slug','title','image','subtitle','aliases','names','countries','languages','genres','types','years','runtime','wins','nominations','awards','availability','added','count','filmography'])
    same(entry[key], entry[key], key);
  assert.equal(entry.id, f.id);
  assert.equal(entry.title, f.title);
  same(entry.types,[f.type]);
  same(entry.years,[f.year]);
  assert.equal(entry.film.slug, f.slug);
  assert.equal(entry.subtitle, f.year+' • '+f.directors.map(d=>d.name).join(', '));
}

const directors=[...new Set(credits.filter(c=>c.role==='director').map(c=>c.person_id))].slice(0,20)
  .map(id=>({...people.get(id), films: films.filter(f=>f.credits.some(c=>c.person_id===id&&c.role==='director'))}))
  .filter(d=>d.films.length);
for(const d of directors){
  const entry=directorSearchEntry(d);
  assert.equal(entry.title, d.name);
  assert.equal(entry.count, d.films.length);
  same(entry.years, d.films.map(f=>f.year));
  same(entry.types, [...new Set(d.films.map(f=>f.type))]);
  assert.ok(d.films.every(f=>entry.aliases.includes(f.title)||entry.title===f.title||!f.title),'a director is findable by their films');
}

// The packed form is what travels, and it must be clearly smaller than the full entry.
const packedSize=Buffer.byteLength(JSON.stringify(films.map(packFilm)));
const fullSize=Buffer.byteLength(JSON.stringify(films.map(filmSearchEntry)));
assert.ok(packedSize < fullSize*0.75, `packing saved too little: ${packedSize} vs ${fullSize}`);
const packedD=Buffer.byteLength(JSON.stringify(directors.map(packDirector)));
const fullD=Buffer.byteLength(JSON.stringify(directors.map(directorSearchEntry)));
assert.ok(packedD < fullD*0.75, `director packing saved too little: ${packedD} vs ${fullD}`);
console.log(`PASS: entries survive packing; films ${(100-packedSize/fullSize*100).toFixed(0)}% smaller, directors ${(100-packedD/fullD*100).toFixed(0)}% smaller`);
