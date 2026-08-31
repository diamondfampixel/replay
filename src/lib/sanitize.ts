/**
 * Minimal allow-list HTML sanitiser for admin-authored page bodies and email
 * blocks.
 *
 * Content here is written by store staff or produced by the assistant, both of
 * which are trusted more than a random visitor — but neither should be able to
 * inject script into a storefront, so everything passes through this before it
 * is stored.
 */

const ALLOWED_TAGS = new Set([
  "p", "br", "strong", "b", "em", "i", "u", "s", "a", "ul", "ol", "li",
  "h1", "h2", "h3", "h4", "blockquote", "hr", "code", "pre", "span", "div",
  "table", "thead", "tbody", "tr", "th", "td", "img",
]);

const ALLOWED_ATTRIBUTES: Record<string, Set<string>> = {
  a: new Set(["href", "title", "target", "rel"]),
  img: new Set(["src", "alt", "width", "height"]),
};

const DANGEROUS_URL = /^\s*(javascript|data|vbscript):/i;

export function sanitizeHtml(input: string): string {
  if (!input) return "";

  // Drop entire elements whose content is executable or style-bearing.
  let html = input
    .replace(/<\s*(script|style|iframe|object|embed|link|meta)[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
    .replace(/<\s*(script|style|iframe|object|embed|link|meta)[^>]*\/?>/gi, "");

  html = html.replace(/<\s*(\/)?\s*([a-zA-Z][a-zA-Z0-9-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/g,
    (match, closing: string | undefined, rawTag: string, rawAttributes: string) => {
      const tag = rawTag.toLowerCase();
      if (!ALLOWED_TAGS.has(tag)) return "";
      if (closing) return `</${tag}>`;

      const allowed = ALLOWED_ATTRIBUTES[tag];
      if (!allowed) return `<${tag}>`;

      const attributes: string[] = [];
      const pattern = /([a-zA-Z-]+)\s*=\s*("([^"]*)"|'([^']*)')/g;
      let attribute: RegExpExecArray | null;
      while ((attribute = pattern.exec(rawAttributes)) !== null) {
        const name = attribute[1].toLowerCase();
        const value = attribute[3] ?? attribute[4] ?? "";
        if (!allowed.has(name)) continue;
        if ((name === "href" || name === "src") && DANGEROUS_URL.test(value)) continue;
        attributes.push(`${name}="${value.replace(/"/g, "&quot;")}"`);
      }

      // External links open safely.
      if (tag === "a" && attributes.some((a) => a.startsWith('target="_blank"'))) {
        attributes.push('rel="noopener noreferrer"');
      }
      return `<${tag}${attributes.length ? ` ${attributes.join(" ")}` : ""}>`;
    },
  );

  // Strip any leftover inline event handlers that survived attribute filtering.
  return html.replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");
}

/** Plain text from HTML, for previews and meta descriptions. */
export function htmlToText(input: string, limit = 200): string {
  const text = input.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return text.length > limit ? `${text.slice(0, limit - 1)}…` : text;
}
