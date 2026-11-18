import type { SearchEntry } from './catalog-search';

/** International breakthrough hits and established classics by Black directors. Editorial
 * recognition, independent of Pheelm saves; intersected with the published catalog only. */
export const RECOGNIZED_FILMS = [
 'black-panther','get-out','moonlight','12-years-a-slave','do-the-right-thing','boyz-n-the-hood','malcolm-x','selma','us','creed','fruitvale-station','love-and-basketball',
 'black-girl','touki-bouki','timbuktu','atlantics','yeelen','moolaade','daughters-of-the-dust','sugar-cane-alley','i-am-not-your-negro','les-miserables','saint-omer','sorry-to-bother-you',
 'judas-and-the-black-messiah','mudbound','if-beale-street-could-talk','13th','shaft','eve-s-bayou','the-watermelon-woman','killer-of-sheep','sankofa','sambizanga','lumumba','bamako',
 'dahomey','on-becoming-a-guinea-fowl','rafiki','i-am-not-a-witch','belle','rye-lane','a-thousand-and-one','pariah','hunger','hyenas','xala','hollywood-shuffle',
];
export function mondayWeek(now=new Date()) {
 // UTC Monday midnight, shared by every visitor and server region.
 return Math.floor((now.getTime()-Date.UTC(1970,0,5))/604800000);
}
export function weeklyPopular<T extends {id:string;slug:string;status:string}>(films:T[],now=new Date(),limit=12):T[] {
 const bySlug=new Map(films.filter(f=>f.status==='published').map(f=>[f.slug,f]));
 const pool=RECOGNIZED_FILMS.flatMap(slug=>bySlug.has(slug)?[bySlug.get(slug)!]:[]);
 if(!pool.length)return [];
 const start=((mondayWeek(now)*12)%pool.length+pool.length)%pool.length;
 return Array.from({length:Math.min(limit,pool.length)},(_,i)=>pool[(start+i)%pool.length]);
}
export function recentlyAdded(entries:SearchEntry[]) {
 return [...entries].sort((a,b)=>b.added-a.added||a.title.localeCompare(b.title)).slice(0,12);
}

export function avoidPrevious(ids:string[],previous:string[]) {
 const seen=new Set(previous.slice(0,12));
 return [...ids.filter(id=>!seen.has(id)),...ids.filter(id=>seen.has(id))];
}
