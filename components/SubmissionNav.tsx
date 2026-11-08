import Link from "next/link";
import Icon from "./Icon";

export default function SubmissionNav({ owner = false }: { owner?: boolean }) {
  return (
    <nav className="tabs submission-tabs" aria-label="Film suggestion type">
      <Link href="/submit" aria-current={!owner ? "page" : undefined}><Icon name="heart" />Film fan</Link>
      <Link href="/submit/your-film" aria-current={owner ? "page" : undefined}><Icon name="clapper" />Film owner</Link>
    </nav>
  );
}
