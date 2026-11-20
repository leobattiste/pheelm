"use client";

import { useState } from "react";
import { posterColours, srcSet } from "@/lib/format";

type Props = {
  title: string;
  year: number;
  directors: string[];
  src: string | null;
  /** Width the poster is shown at, so phones fetch a small image. */
  sizes?: string;
  priority?: boolean;
  /** The poster at the top of a film page, which cards morph into. */
  hero?: boolean;
};

/**
 * The film's poster, fading in once loaded, or a title card in the film's colour
 * until a real poster is added.
 */
export default function Poster({ title, year, directors, src, sizes = "(min-width: 900px) 200px, 45vw", priority, hero }: Props) {
  // A poster that can't be fetched (offline, a dead link, a blocked image host) falls back to the
  // title card, so a card is never an empty box. Both are remembered against the image they
  // describe: when a card is reused for another film, or a poster is replaced, the new image
  // starts afresh instead of inheriting the old one's failure.
  const [attempt, setAttempt] = useState<{ src: string | null; loaded: boolean; failed: boolean }>({ src: src ?? null, loaded: false, failed: false });
  const current = attempt.src === (src ?? null) ? attempt : { src: src ?? null, loaded: false, failed: false };
  if (current !== attempt) setAttempt(current);
  const { loaded: isLoaded, failed } = current;
  const settle = (change: { loaded?: boolean; failed?: boolean }) => setAttempt({ src: src ?? null, loaded: false, failed: false, ...change });
  const cls = `poster${hero ? " poster-hero" : ""}`;

  if (src && !failed) {
    return (
      <div className={cls} data-poster="">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          srcSet={srcSet(src)}
          sizes={sizes}
          alt={`Poster for ${title}`}
          loading={priority ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : undefined}
          decoding="async"
          className={isLoaded ? "is-loaded" : undefined}
          onLoad={() => settle({ loaded: true })}
          onError={() => settle({ failed: true })}
          ref={(img) => {
            if (!img || img.currentSrc === "" || !img.complete) return;
            // The image may have finished, or failed, before React attached the handlers above.
            if (img.naturalWidth > 0) { if (!isLoaded) settle({ loaded: true }); }
            else settle({ failed: true });
          }}
        />
      </div>
    );
  }

  const { bg, fg } = posterColours(title);
  return (
    <div className={`${cls} poster-card`} data-poster="" style={{ background: bg, color: fg }} role="img" aria-label={`${title}, ${year}`}>
      <span className="poster-card-title">{title}</span>
      <span className="poster-card-foot">
        <span>{directors.join(", ")}</span>
        <span>{year}</span>
      </span>
    </div>
  );
}
