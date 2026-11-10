import {watchlistShareImage} from '@/lib/watchlist-share-image';
export const size={width:1200,height:630};
export const contentType='image/png';
export const alt='Watchlists on Pheelm';
export const dynamic='force-dynamic';
export default async function Image({params}:{params:Promise<{slug:string}>}){return watchlistShareImage((await params).slug,'slug');}
