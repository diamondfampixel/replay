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

/**
 * Schemes a link or image may use. This is an allow-list rather than a list of
 * blocked schemes: a browser understands more of them than any deny-list keeps
 * up with, and an unknown scheme is not worth the risk.
 */
const ALLOWED_SCHEMES = new Set(["http", "https", "mailto", "tel"]);

/** Strips the characters a browser ignores when it resolves a URL's scheme. */
const IGNORED_IN_URL = new RegExp(
  "[" + String.fromCharCode(0) + "-" + String.fromCharCode(32) + String.fromCharCode(127) + "]",
  "g",
);

/**
 * Resolves a URL the way the HTML parser will, then decides whether the scheme
 * is allowed.
 *
 * Testing the raw attribute is not enough. The parser decodes entities and
 * drops control characters before anything looks at the scheme, so
 * `&#106;avascript:` and `jav&#9;ascript:` both reach the navigation layer as
 * `javascript:` even though neither matches that string as written.
 */
function isSafeUrl(rawValue: string): boolean {
  let value = rawValue;

  // Decoding can expose another layer of encoding, so repeat to a fixed point.
  for (let pass = 0; pass < 3; pass++) {
    const decoded = value
      .replace(/&#x([0-9a-f]+);?/gi, (_match, hex: string) =>
        String.fromCharCode(parseInt(hex, 16)),
      )
      .replace(/&#(\d+);?/g, (_match, dec: string) => String.fromCharCode(parseInt(dec, 10)))
      .replace(/&colon;?/gi, ":")
      .replace(/&tab;?/gi, String.fromCharCode(9))
      .replace(/&newline;?/gi, String.fromCharCode(10));
    if (decoded === value) break;
    value = decoded;
  }

  value = value.replace(IGNORED_IN_URL, "").trim();

  // No scheme at all means a relative URL, which cannot execute.
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(value);
  if (!scheme) return true;
  return ALLOWED_SCHEMES.has(scheme[1].toLowerCase());
}

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
        if ((name === "href" || name === "src") && !isSafeUrl(value)) continue;
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
