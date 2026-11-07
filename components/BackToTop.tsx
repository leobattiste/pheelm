"use client";

import Icon from "@/components/Icon";
/** Takes you back to the top of the page, smoothly unless reduced motion is on. */
export default function BackToTop() {
  const top = () => {
    const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: smooth ? "smooth" : "auto" });
    document.querySelector<HTMLElement>(".wordmark")?.focus({ preventScroll: true });
  };
  return (
    <button type="button" className="button ghost small back-to-top" onClick={top}>
      <Icon name="arrowUp" />
      Back to top
    </button>
  );
}
