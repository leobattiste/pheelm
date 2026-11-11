import { Body, Button, Container, Head, Heading, Hr, Html, Link, Preview, Section, Text } from 'react-email';

export type EmailProps = { title: string; message: string; actionUrl: string; actionLabel: string; unsubscribeUrl?: string; postalAddress?: string; code?: string };
/** A single email-safe layout. No web fonts, blur, scripts, or external images. */
export default function PheelmEmail({title,message,actionUrl,actionLabel,unsubscribeUrl,postalAddress,code}: EmailProps) {
 return <Html lang="en"><Head/><Preview>{title}</Preview><Body style={{backgroundColor:'#0b0b0b',fontFamily:'Arial, Helvetica, sans-serif',margin:0,padding:'24px 12px'}}>
  <Container style={{maxWidth:560,backgroundColor:'#181818',borderRadius:18,color:'#fff',padding:'32px 24px'}}>
   <Text style={{fontSize:24,fontWeight:700,color:'#fff',margin:'0 0 28px'}}>Pheelm</Text>
   <Heading as="h1" style={{fontSize:28,lineHeight:'34px',color:'#fff'}}>{title}</Heading>
   <Text style={{fontSize:16,lineHeight:'25px',color:'#fff',whiteSpace:'pre-line'}}>{message}</Text>
   {code&&<Text style={{fontSize:28,letterSpacing:'4px',color:'#fff'}}>{code}</Text>}
   <Section style={{padding:'16px 0'}}><Button href={actionUrl} style={{boxSizing:'border-box',backgroundColor:'#fff',color:'#0c0c0c',borderRadius:24,padding:'14px 24px',fontSize:16,fontWeight:600,textDecoration:'none'}}>{actionLabel}</Button></Section>
   <Hr style={{borderTop:'1px solid #3d3d3d',margin:'24px 0'}}/>
   <Text style={{fontSize:12,lineHeight:'18px',color:'#bdbdbd'}}>{unsubscribeUrl?'You chose to receive these updates from Pheelm.':'This email relates to your account or a request you made to Pheelm.'}<br/>
    <Link href="mailto:hey@pheelm.com" style={{color:'#fff'}}>hey@pheelm.com</Link>{unsubscribeUrl&&<> · <Link href={unsubscribeUrl} style={{color:'#fff'}}>Email preferences and unsubscribe</Link></>}
    {postalAddress&&<><br/>{postalAddress}</>}<br/>© 2026 Pheelm. A project by Leo Battiste with the courtesy of TMDB.</Text>
  </Container></Body></Html>;
}
PheelmEmail.PreviewProps={title:'Welcome to Pheelm',message:'Discover films, make watchlists, and follow directors. Your account is ready.',actionUrl:'https://www.pheelm.com/films',actionLabel:'Explore films'} satisfies EmailProps;
