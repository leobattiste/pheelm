"use client";

import { Children, useState, type ReactNode } from "react";
import { PAGE_SIZE } from "@/lib/site";
import { BackToTopButton } from "./BackToTop";

/**
 * A list that shows a screenful at a time (PAGE_SIZE) with a "Load more" button. The items are drawn
 * on the server, so the first screenful is in the saved page; the rest are only revealed here.
 */
export default function Paged({ className, children, size = PAGE_SIZE }: { className: string; children: ReactNode; size?: number }) {
  const items = Children.toArray(children);
  const [shown, setShown] = useState(size);
  return (
    <>
      <ul className={className}>{items.slice(0, shown)}</ul>
      {shown < items.length && (
        <div className="pagination-controls">
          <button type="button" className="button ghost more" onClick={() => setShown((n) => n + size)}>Load more</button>
          <BackToTopButton />
        </div>
      )}
    </>
  );
}
