/** The loading line, drawn over a bar's top edge (or, with `top`, along the top of the screen). Shown by NavProgress. */
export default function NavProgressLine({ top = false }: { top?: boolean }) {
  return <span className={top ? "nav-progress is-top" : "nav-progress"} aria-hidden="true" />;
}

