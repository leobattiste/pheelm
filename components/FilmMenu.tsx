import Link from "next/link";
import Icon from "./Icon";
import MoreMenu from "./MoreMenu";
import ShareButton from "./ShareButton";
import WatchedButton from "./WatchedButton";

/** The "⋯" beside Trailer and Watchlist on a film: Add to Watched, Give feedback, Share. */
export default function FilmMenu({ filmId, slug, title }: { filmId: string; slug: string; title: string }) {
  return (
    <MoreMenu label={`More for ${title}`}>
      <WatchedButton filmId={filmId} />
      <Link className="button ghost" href={`/contact?topic=feedback&film=${encodeURIComponent(slug)}`}>
        <Icon name="comment" />
        Give feedback
      </Link>
      <ShareButton item title={title} />
    </MoreMenu>
  );
}
