import { setListFlag } from "@/app/admin/actions";
import Icon from "./Icon";

/** For admins, in a community collection's menu: put it under Featured on the Collections page, or take it off. */
export default function FeatureCollection({ listId, featured }: { listId: string; featured: boolean }) {
  return (
    <form action={setListFlag}>
      <input type="hidden" name="id" value={listId} />
      <input type="hidden" name="field" value="featured" />
      <input type="hidden" name="value" value={featured ? "false" : "true"} />
      <input type="hidden" name="back" value={`/c/${listId}`} />
      <button type="submit" className="button ghost">
        <Icon name="sparkle" />
        {featured ? "Unfeature" : "Feature"}
      </button>
    </form>
  );
}
