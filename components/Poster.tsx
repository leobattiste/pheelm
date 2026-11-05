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
  const [loaded, setLoaded] = useState(false);
  const cls = `poster${hero ? " poster-hero" : ""}`;

  if (src) {
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
          className={loaded ? "is-loaded" : undefined}
          onLoad={() => setLoaded(true)}
          ref={(img) => {
            if (img?.complete && !loaded) setLoaded(true);
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
