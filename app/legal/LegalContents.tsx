"use client";

type Props = {
  prefix: string;
  headings: string[];
};

/** Navigate policy sections without changing the active Legal tab's URL hash. */
export default function LegalContents({ prefix, headings }: Props) {
  function goToSection(id: string) {
    const heading = document.getElementById(id);
    if (!heading) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    heading.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
    heading.focus({ preventScroll: true });
  }

  return (
    <nav className="legal-toc" aria-label="Sections in this policy">
      <p className="legal-toc-title">On this page</p>
      <ol>
        {headings.map((heading, index) => {
          const id = `${prefix}-${index + 1}`;
          return (
            <li key={id}>
              <button type="button" onClick={() => goToSection(id)}>
                {heading}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
