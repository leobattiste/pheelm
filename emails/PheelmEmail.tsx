import { Body, Button, Column, Container, Head, Heading, Hr, Html, Img, Link, Row, Section, Text } from 'react-email';
import type { ReactNode } from 'react';

export type EmailProps = {
  title: string; message: string; actionUrl: string; actionLabel: string;
  /** One line shown beside the subject in the inbox list. */
  preheader?: string;
  /** Up to three short "good to know" rows: [label, sentence]. None for a Digest. */
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
/** The site's dark theme. Every email is dark with white type. */
const c = { page: '#0b0b0b', card: '#181818', inset: '#262626', line: '#2e2e2e', ink: '#ffffff', body: '#e6e6e6', soft: '#b8b8b8', faint: '#9a9a9a' };
const sans = 'Arial, Helvetica, sans-serif';
/**
 * Keeping it dark in mail apps that recolour emails in dark mode:
 * - Backgrounds are also painted as a background-image, which those apps leave alone.
 * - Gmail's app inverts text colours; the two blend layers (Gmail only, via `u + .body`) undo that,
 *   and change nothing anywhere else. Other apps are told the email is already dark.
 */
const CSS = `:root{color-scheme:dark;supported-color-schemes:dark}
u + .body .gm-s{background:#000;mix-blend-mode:screen}
u + .body .gm-d{background:#000;mix-blend-mode:difference}`;
const paint = (color: string) => ({ backgroundColor: color, backgroundImage: `linear-gradient(${color},${color})` });
/** Text that stays its colour in Gmail's dark mode. */
const G = ({ children }: { children: ReactNode }) => <span className="gm-s" style={{ display: 'block' }}><span className="gm-d" style={{ display: 'block' }}>{children}</span></span>;

/** One layout for every email: wordmark, title, message, optional code, button, good-to-know rows, a note, and a footer. No web fonts, scripts or blur. */
export default function PheelmEmail({ title, message, actionUrl, actionLabel, preheader = title, rows = [], note, code, unsubscribeUrl, postalAddress, year = String(new Date().getFullYear()), pad = '' }: EmailProps) {
  const link = { color: c.ink, textDecoration: 'underline' } as const;
  return <Html lang="en" dir="ltr"><Head>
    <meta name="color-scheme" content="dark" /><meta name="supported-color-schemes" content="dark" /><title>{title}</title>
    <style>{CSS}</style>
  </Head>
  <div data-skip-in-text="true" style={{ display: 'none', overflow: 'hidden', lineHeight: '1px', opacity: 0, maxHeight: 0, maxWidth: 0 }}>{preheader}{pad}</div>
  <Body className="body" style={{ ...paint(c.page), fontFamily: sans, margin: 0, padding: '28px 12px' }}>
    <Container style={{ maxWidth: 600, width: '100%' }}>
      <Section data-skip-in-text="true" style={{ padding: '4px 8px 22px' }}>
        <Link href={SITE} style={{ textDecoration: 'none' }}>
          <Img src={`${SITE}/brand/pheelm-wordmark-email.png`} width={102} height={42} alt="pheelm" style={{ display: 'block', border: 0, fontFamily: 'Georgia, serif', fontStyle: 'italic', fontSize: 30, color: c.ink }} />
        </Link>
      </Section>

      <Section style={{ ...paint(c.card), borderRadius: 22, border: `1px solid ${c.line}`, padding: '36px 32px 32px' }}>
        <Heading as="h1" style={{ fontSize: 28, lineHeight: '34px', fontWeight: 700, color: c.ink, margin: '0 0 14px' }}><G>{title}</G></Heading>
        <Text style={{ fontSize: 16, lineHeight: '26px', color: c.body, margin: '0 0 8px' }}><G>{message}</G></Text>

        {code && <Section style={{ margin: '22px 0 4px' }}><Text style={{ display: 'inline-block', margin: 0, padding: '14px 22px', ...paint(c.inset), borderRadius: 14, fontFamily: '"Courier New", Courier, monospace', fontSize: 30, lineHeight: '34px', fontWeight: 700, letterSpacing: '6px', color: c.ink }}><G>{code}</G></Text></Section>}

        <Section style={{ padding: '22px 0 8px' }}>
          <Button href={actionUrl} style={{ boxSizing: 'border-box', ...paint(c.inset), color: c.ink, borderRadius: 28, padding: '15px 28px', fontSize: 16, lineHeight: '20px', fontWeight: 700, textDecoration: 'none', display: 'inline-block' }}><G>{actionLabel}</G></Button>
        </Section>
        <Text style={{ fontSize: 12, lineHeight: '18px', color: c.faint, margin: '10px 0 0' }}><G>Button not working? Paste this link into your browser:<br /><Link href={actionUrl} style={{ color: c.soft, wordBreak: 'break-all' }}>{actionUrl}</Link></G></Text>

        {rows.length > 0 && <><Hr style={{ borderTop: `1px solid ${c.line}`, borderBottom: 0, margin: '30px 0 8px' }} />
          {rows.map(([label, text], i) => <Row key={i} style={{ borderBottom: i < rows.length - 1 ? `1px solid ${c.line}` : 0 }}><Column style={{ padding: '14px 0' }}>
            <Text style={{ fontSize: 15, lineHeight: '22px', fontWeight: 700, color: c.ink, margin: '0 0 2px' }}><G>{label}</G></Text>
            <Text style={{ fontSize: 14, lineHeight: '22px', color: c.soft, margin: 0 }}><G>{text}</G></Text>
          </Column></Row>)}</>}

        {note && <Section style={{ marginTop: 22 }}><Text style={{ margin: 0, padding: '14px 16px', ...paint(c.inset), borderRadius: 14, fontSize: 13, lineHeight: '20px', color: c.body }}><G>{note}</G></Text></Section>}
      </Section>

      <Section style={{ padding: '24px 8px 0' }}>
        <Text style={{ fontSize: 12, lineHeight: '19px', color: c.faint, margin: '0 0 10px' }}><G>
          {unsubscribeUrl ? 'You’re getting this because you chose to receive these updates from Pheelm.' : 'You’re getting this because of your Pheelm account or a request you made to Pheelm.'}
        </G></Text>
        <Text style={{ fontSize: 12, lineHeight: '19px', color: c.faint, margin: '0 0 10px' }}><G>
          <Link href={`${SITE}/help`} style={link}>Help</Link> · <Link href="mailto:hey@pheelm.com" style={link}>hey@pheelm.com</Link> · <Link href={`${SITE}/privacy`} style={link}>Privacy</Link> · <Link href={`${SITE}/terms`} style={link}>Terms</Link>
          {unsubscribeUrl && <> · <Link href={unsubscribeUrl} style={link}>Email preferences and unsubscribe</Link></>}
        </G></Text>
        <Text style={{ fontSize: 12, lineHeight: '19px', color: c.faint, margin: 0 }}><G>
          {postalAddress && <>{postalAddress}<br /></>}© {year} Pheelm
        </G></Text>
      </Section>
    </Container>
  </Body></Html>;
}
PheelmEmail.PreviewProps = { title: 'Welcome to Pheelm', message: 'Discover films, make watchlists and follow directors. Your account is ready.', actionUrl: 'https://www.pheelm.com/films', actionLabel: 'Explore films' } satisfies EmailProps;
