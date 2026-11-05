import { posterColours } from "@/lib/format";

type Props = {
  title: string;
  year: number;
  directors: string[];
  src: string | null;
  size?: "card" | "large";
  priority?: boolean;
};

/**
 * The film's poster, or a typographic stand-in in a colour picked from the title
 * until a real poster is added in the admin.
 */
export default function Poster({ title, year, directors, src, size = "card", priority }: Props) {
  if (src) {
    return (
      <div className={`poster poster-${size}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={`Poster for ${title}`} loading={priority ? "eager" : "lazy"} decoding="async" />
      </div>
    );
  }
  const { bg, fg } = posterColours(title);
  return (
    <div className={`poster poster-${size} poster-blank`} style={{ background: bg, color: fg }} role="img" aria-label={`${title}, no poster yet`}>
      <span className="poster-director">{directors.join(" · ")}</span>
      <span className="poster-title">{title}</span>
      <span className="poster-year">{year}</span>
    </div>
  );
}
