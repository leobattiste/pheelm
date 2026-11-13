import {watchlistShareImage} from '@/lib/watchlist-share-image';
export const size={width:1200,height:630};
export const contentType='image/png';
export const alt='Watchlists on Pheelm';
// Rendered at most every 10 minutes per watchlist, not on every request.
export const revalidate=600;
// None built ahead of time; each is cached the first time it's asked for.
export function generateStaticParams(){return [];}
export default async function Image({params}:{params:Promise<{id:string}>}){return watchlistShareImage((await params).id,'id');}
