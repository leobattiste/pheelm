import FeedbackLink from "./FeedbackLink";
import MoreMenu from "./MoreMenu";
import ShareButton from "./ShareButton";
import WatchedButton from "./WatchedButton";

/** The "⋯" beside Trailer and Watchlist on a film: Add to Watched, Give feedback, Share. */
export default function FilmMenu({ filmId, slug, title }: { filmId: string; slug: string; title: string }) {
  return (
    <MoreMenu label={`More for ${title}`}>
      <WatchedButton filmId={filmId} />
      <FeedbackLink about={`/films/${slug}`} label={title} />
      <ShareButton item title={title} />
    </MoreMenu>
  );
}
