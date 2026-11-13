import { ImageResponse } from 'next/og';
import sharp from 'sharp';
import { OgWordmark, ogFonts } from './og';
import { seoText } from './seo';
import { SUPABASE_URL } from './supabase/config';

export const SHARE_SIZE={width:1200,height:630};
// private: never cached. cache: seconds the CDN may keep a public image (default an hour).
type ShareImage={title:string;label:string;description?:string|null;image?:string|null;private?:boolean;cache?:number};

/** A broken or unsupported poster/portrait always leaves a complete branded preview. */
async function artwork(source:string|null|undefined):Promise<string|null>{
 if(!source)return null;
 try{
  const url=new URL(source);
  const hosts=['image.tmdb.org'];if(SUPABASE_URL)hosts.push(new URL(SUPABASE_URL).hostname);
  if(url.protocol!=='https:'||url.username||url.password||!hosts.includes(url.hostname)||url.port)return null;
  const response=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(5000),cache:'force-cache'});
  if(!response.ok||!/^image\/(jpeg|png|webp|avif)(;|$)/i.test(response.headers.get('content-type')??''))return null;
  if(Number(response.headers.get('content-length')??0)>5*1024*1024)return null;
  const reader=response.body?.getReader();if(!reader)return null;
  const chunks:Uint8Array[]=[];let length=0;
  for(;;){const part=await reader.read();if(part.done)break;length+=part.value.length;if(length>5*1024*1024){await reader.cancel();return null;}chunks.push(part.value);}
  const buffer=await sharp(Buffer.concat(chunks),{limitInputPixels:40_000_000}).rotate().resize(668,1004,{fit:'cover'}).png().toBuffer();
  return 'data:image/png;base64,'+buffer.toString('base64');
 }catch{return null;}
}

/** One composition for every Pheelm preview: wordmark, title and copy, with 2:3 artwork. */
export async function shareImage(input:ShareImage){
 const [fonts,image]=await Promise.all([ogFonts(),artwork(input.image)]);
 const title=seoText(input.title,110),description=seoText(input.description??'Discover films by Black directors around the world.',155);
 return new ImageResponse(
  <div style={{display:'flex',width:'100%',height:'100%',background:'#0b0b0b',color:'#fafafa',padding:64,gap:64,fontFamily:'Switzer, Inter'}}>
   <div style={{display:'flex',flexDirection:'column',justifyContent:'space-between',width:674}}>
    <OgWordmark size={48}/>
    <div style={{display:'flex',flexDirection:'column',gap:20}}>
     <div style={{display:'flex',fontSize:20,letterSpacing:2,color:'#a8a8a8'}}>{seoText(input.label,65)}</div>
     <div style={{display:'flex',fontSize:title.length>65?46:title.length>32?58:72,fontWeight:700,lineHeight:1.06,letterSpacing:-2,wordBreak:'break-word'}}>{title}</div>
     <div style={{display:'flex',fontSize:23,lineHeight:1.35,color:'#b8b8b8'}}>{description}</div>
    </div>
   </div>
   <div style={{display:'flex',width:334,height:502,flexShrink:0,borderRadius:18,overflow:'hidden',border:'1px solid #333333',background:'#191919',alignItems:'center',justifyContent:'center'}}>
    {image?<img src={image} width={334} height={502} alt="" style={{objectFit:'cover'}}/>:<div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:32}}><OgWordmark size={64}/><div style={{display:'flex',fontSize:18,color:'#a8a8a8'}}>Made for the love of cinema.</div></div>}
   </div>
  </div>,
  {...SHARE_SIZE,fonts,headers:{'Cache-Control':input.private?'private, no-store':`public, max-age=0, s-maxage=${input.cache??3600}`}},
 );
}
