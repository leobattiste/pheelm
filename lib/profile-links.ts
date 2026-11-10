export const SOCIAL_PLATFORMS = [
 {id:'instagram',label:'Instagram',icon:'instagram',hosts:['instagram.com']},
 {id:'tiktok',label:'TikTok',icon:'tiktok',hosts:['tiktok.com']},
 {id:'youtube',label:'YouTube',icon:'youtube',hosts:['youtube.com','youtu.be']},
 {id:'threads',label:'Threads',icon:'threads',hosts:['threads.com','threads.net']},
 {id:'x',label:'X',icon:'xSocial',hosts:['x.com','twitter.com']},
 {id:'facebook',label:'Facebook',icon:'facebook',hosts:['facebook.com','fb.com']},
 {id:'bluesky',label:'Bluesky',icon:'bluesky',hosts:['bsky.app']},
 {id:'linkedin',label:'LinkedIn',icon:'linkedin',hosts:['linkedin.com']},
] as const;
export type ProfileLinks={social_platform?:string|null;social_url?:string|null;website_url?:string|null};
export function websiteUrl(value:string):string|null{
 const input=value.trim();if(!input)return null;if(input.length>500)throw Error('Keep links to 500 characters or fewer.');
 let url:URL;try{url=new URL(/^[a-z][a-z0-9+.-]*:/i.test(input)?input:'https://'+input);}catch{throw Error('Enter a valid website address.');}
 if(!['https:','http:'].includes(url.protocol)||url.username||url.password||!url.hostname.includes('.'))throw Error('Use a valid http or https website address.');
 return url.href;
}
export function socialLink(platform:string,value:string):{platform:string|null;url:string|null}{
 const raw=value.trim();if(!raw)return{platform:null,url:null};const selected=SOCIAL_PLATFORMS.find(p=>p.id===platform);if(!selected)throw Error('Choose the social platform for your link.');
 const href=websiteUrl(raw)!;const url=new URL(href);if(url.protocol!=='https:'||url.port||!selected.hosts.some(host=>url.hostname===host||url.hostname.endsWith('.'+host)))throw Error(`Enter a valid ${selected.label} profile link.`);
 return{platform:selected.id,url:href};
}
