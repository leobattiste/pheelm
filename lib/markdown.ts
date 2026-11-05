/**
 * A small, safe Markdown subset for journal pieces: paragraphs, ## and ### headings,
 * > quotes, - lists, **bold**, *italic*, [links](https://…) and ![images](https://…).
 * Everything is escaped first, so pasted HTML shows as text.
 */
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const safeUrl = (u: string) => (/^(https?:\/\/|\/)/i.test(u) ? u : "#");

function inline(s: string) {
  return esc(s)
    .replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_m, alt, url) => `<img src="${safeUrl(url)}" alt="${alt}" loading="lazy" />`)
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, text, url) => `<a href="${safeUrl(url)}">${text}</a>`)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>");
}

export function renderMarkdown(src: string) {
  return src
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((block) => {
      const b = block.trim();
      if (!b) return "";
      if (b.startsWith("### ")) return `<h3>${inline(b.slice(4))}</h3>`;
      if (b.startsWith("## ")) return `<h2>${inline(b.slice(3))}</h2>`;
      if (b.startsWith("> ")) return `<blockquote><p>${inline(b.replace(/^> ?/gm, ""))}</p></blockquote>`;
      if (/^- /.test(b)) return `<ul>${b.split("\n").map((l) => `<li>${inline(l.replace(/^- /, ""))}</li>`).join("")}</ul>`;
      return `<p>${inline(b).replace(/\n/g, "<br />")}</p>`;
    })
    .join("\n");
}

export function readingTime(src: string) {
  return Math.max(1, Math.round(src.split(/\s+/).length / 230));
}
