import { accentFor } from "@/lib/poster-accent";

const HEX = /^#[0-9a-f]{6}$/i;

/**
 * Hands a film's own colour to the page while it's open — header, bars and sheets included.
 *
 * The colour is measured from the poster (lib/poster-accent.ts) and arrives already adjusted for
 * each theme, so near-black or white text reads on it. Rendered as variables on :root rather than
 * on the article, because the bar, the ⋯ menu and the dialogs all sit outside it; they go away with
 * the page. A film whose poster has no real colour renders nothing, and the page stays monotone.
 */
export default function FilmTint({ accent }: { accent?: string | null }) {
  const a = accentFor(accent);
  if (!a) return null;
  // Only values this file's own maths produced end up in a stylesheet, and each is checked again.
  if (![a.light, a.onLight, a.dark, a.onDark].every((v) => HEX.test(v))) return null;
  const css =
    `:root,:root[data-theme="dark"]{--film-accent:${a.dark};--film-on-accent:${a.onDark}}` +
    `:root[data-theme="light"]{--film-accent:${a.light};--film-on-accent:${a.onLight}}` +
    // A wash of the colour through the glass of the bars and menus, not a fill.
    `:root{--film-glass:color-mix(in srgb, var(--film-accent) 12%, var(--glass-bg));` +
    `--film-glass-hover:color-mix(in srgb, var(--film-accent) 18%, var(--glass-hover))}`;
  return <style>{css}</style>;
}
