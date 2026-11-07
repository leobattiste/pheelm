/**
 * Feedback always says what it's about: the page it came from, or a part of one ("/films/x#watch"),
 * with a readable name ("Where to watch: Daughters of the Dust").
 */
export function feedbackHref(about: string, label: string) {
  return `/contact?topic=feedback&about=${encodeURIComponent(about)}&label=${encodeURIComponent(label.slice(0, 200))}`;
}

/** Only Pheelm's own paths can be what feedback is about. */
export function safeAbout(value: string | undefined | null) {
  return value && value.startsWith("/") && !value.startsWith("//") && !value.includes("\\") && value.length <= 500 ? value : null;
}
