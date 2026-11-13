import { Body, Button, Column, Container, Head, Heading, Hr, Html, Img, Link, Row, Section, Text } from 'react-email';

export type EmailProps = {
  title: string; message: string; actionUrl: string; actionLabel: string;
  /** One line shown beside the subject in the inbox list. */
  preheader?: string;
  /** Three short "good to know" rows: [label, sentence]. */
  rows?: [string, string][];
  /** A closing line in its own box, such as "Didn't ask for this?". */
  note?: string;
  /** A one-time code (sign-in, confirmation, reset). */
  code?: string;
  unsubscribeUrl?: string; postalAddress?: string;
  /** Four digits. Worker and previews pass the real year. */
  year?: string;
  /** Invisible filler that stops a client showing body text after the preheader. */
  pad?: string;
};

const SITE = 'https://www.pheelm.com';
/**
 * The site's light theme. Light is the base because mail apps in dark mode darken light emails
 * well (Gmail inverts them) but turn dark emails pale gray. Apple Mail and others that honour
 * prefers-color-scheme get the site's dark theme from the classes below.
 */
const c = { page: '#f3f3f3', card: '#ffffff', inset: '#f3f3f3', line: '#e6e6e6', ink: '#0c0c0c', body: '#262626', soft: '#555555', faint: '#666666' };
const sans = 'Arial, Helvetica, sans-serif';
const DARK = `:root{color-scheme:light dark;supported-color-schemes:light dark}
@media (prefers-color-scheme: dark){
.pm-page,.pm-page>table>tbody>tr>td{background-color:#0b0b0b !important}
.pm-card{background-color:#181818 !important;border-color:#2e2e2e !important}
.pm-inset{background-color:#202020 !important;border-color:#2e2e2e !important}
.pm-line{border-color:#2e2e2e !important}
.pm-ink,.pm-ink a,a.pm-ink{color:#ffffff !important}
.pm-body{color:#e6e6e6 !important}
.pm-soft,a.pm-soft{color:#b8b8b8 !important}
.pm-faint{color:#9a9a9a !important}
.pm-btn{background-color:#ffffff !important;color:#0c0c0c !important}
}`;

/** One layout for every email: wordmark, title, message, optional code, button, three good-to-know rows, a note, and a footer. No web fonts, scripts or blur. */
export default function PheelmEmail({ title, message, actionUrl, actionLabel, preheader = title, rows = [], note, code, unsubscribeUrl, postalAddress, year = String(new Date().getFullYear()), pad = '' }: EmailProps) {
  const link = { color: c.ink, textDecoration: 'underline' } as const;
  return <Html lang="en" dir="ltr"><Head>
    <meta name="color-scheme" content="light dark" /><meta name="supported-color-schemes" content="light dark" /><title>{title}</title>
    <style>{DARK}</style>
  </Head>
  <div data-skip-in-text="true" style={{ display: 'none', overflow: 'hidden', lineHeight: '1px', opacity: 0, maxHeight: 0, maxWidth: 0 }}>{preheader}{pad}</div>
  <Body className="pm-page" style={{ backgroundColor: c.page, fontFamily: sans, margin: 0, padding: '28px 12px' }}>
    <Container style={{ maxWidth: 600, width: '100%' }}>
      <Section data-skip-in-text="true" style={{ padding: '4px 8px 22px' }}>
        <Link href={SITE} style={{ textDecoration: 'none' }}>
          {/* A black badge with the wordmark: it reads on light and dark backgrounds, and mail apps don't invert images. */}
          <Img src={`${SITE}/brand/pheelm-badge-email.png`} width={112} height={44} alt="pheelm" style={{ display: 'block', border: 0, borderRadius: 12, fontFamily: 'Georgia, serif', fontStyle: 'italic', fontSize: 26, color: c.ink }} />
        </Link>
      </Section>

      <Section className="pm-card" style={{ backgroundColor: c.card, borderRadius: 22, border: `1px solid ${c.line}`, padding: '36px 32px 32px' }}>
        <Heading as="h1" className="pm-ink" style={{ fontSize: 28, lineHeight: '34px', fontWeight: 700, color: c.ink, margin: '0 0 14px' }}>{title}</Heading>
        <Text className="pm-body" style={{ fontSize: 16, lineHeight: '26px', color: c.body, margin: '0 0 8px' }}>{message}</Text>

        {code && <Section style={{ margin: '22px 0 4px' }}><Text className="pm-inset pm-ink" style={{ display: 'inline-block', margin: 0, padding: '14px 22px', backgroundColor: c.inset, border: `1px solid ${c.line}`, borderRadius: 14, fontFamily: '"Courier New", Courier, monospace', fontSize: 30, lineHeight: '34px', fontWeight: 700, letterSpacing: '6px', color: c.ink }}>{code}</Text></Section>}

        <Section style={{ padding: '22px 0 8px' }}>
          <Button href={actionUrl} className="pm-btn" style={{ boxSizing: 'border-box', backgroundColor: c.ink, color: '#ffffff', borderRadius: 28, padding: '15px 28px', fontSize: 16, lineHeight: '20px', fontWeight: 700, textDecoration: 'none', display: 'inline-block' }}>{actionLabel}</Button>
        </Section>
        <Text className="pm-faint" style={{ fontSize: 12, lineHeight: '18px', color: c.faint, margin: '10px 0 0' }}>Button not working? Paste this link into your browser:<br /><Link href={actionUrl} className="pm-soft" style={{ color: c.soft, wordBreak: 'break-all' }}>{actionUrl}</Link></Text>

        {rows.length > 0 && <><Hr className="pm-line" style={{ borderTop: `1px solid ${c.line}`, borderBottom: 0, margin: '30px 0 8px' }} />
          {rows.map(([label, text], i) => <Row key={i} className={i < rows.length - 1 ? 'pm-line' : undefined} style={{ borderBottom: i < rows.length - 1 ? `1px solid ${c.line}` : 0 }}><Column style={{ padding: '14px 0' }}>
            <Text className="pm-ink" style={{ fontSize: 15, lineHeight: '22px', fontWeight: 700, color: c.ink, margin: '0 0 2px' }}>{label}</Text>
            <Text className="pm-soft" style={{ fontSize: 14, lineHeight: '22px', color: c.soft, margin: 0 }}>{text}</Text>
          </Column></Row>)}</>}

        {note && <Section style={{ marginTop: 22 }}><Text className="pm-inset pm-body" style={{ margin: 0, padding: '14px 16px', backgroundColor: c.inset, borderRadius: 14, fontSize: 13, lineHeight: '20px', color: c.body }}>{note}</Text></Section>}
      </Section>

      <Section style={{ padding: '24px 8px 0' }}>
        <Text className="pm-faint" style={{ fontSize: 12, lineHeight: '19px', color: c.faint, margin: '0 0 10px' }}>
          {unsubscribeUrl ? 'You’re getting this because you chose to receive these updates from Pheelm.' : 'You’re getting this because of your Pheelm account or a request you made to Pheelm.'}
        </Text>
        <Text className="pm-faint" style={{ fontSize: 12, lineHeight: '19px', color: c.faint, margin: '0 0 10px' }}>
          <Link href={`${SITE}/help`} className="pm-ink" style={link}>Help</Link> · <Link href="mailto:hey@pheelm.com" className="pm-ink" style={link}>hey@pheelm.com</Link> · <Link href={`${SITE}/privacy`} className="pm-ink" style={link}>Privacy</Link> · <Link href={`${SITE}/terms`} className="pm-ink" style={link}>Terms</Link>
          {unsubscribeUrl && <> · <Link href={unsubscribeUrl} className="pm-ink" style={link}>Email preferences and unsubscribe</Link></>}
        </Text>
        <Text className="pm-faint" style={{ fontSize: 12, lineHeight: '19px', color: c.faint, margin: 0 }}>
          {postalAddress && <>{postalAddress}<br /></>}© {year} Pheelm
        </Text>
      </Section>
    </Container>
  </Body></Html>;
}
PheelmEmail.PreviewProps = { title: 'Welcome to Pheelm', message: 'Discover films, make watchlists and follow directors. Your account is ready.', actionUrl: 'https://www.pheelm.com/films', actionLabel: 'Explore films' } satisfies EmailProps;
