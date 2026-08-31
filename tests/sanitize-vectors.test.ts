import { describe, expect, it } from "vitest";
import { sanitizeHtml } from "@/lib/sanitize";

/**
 * The sanitiser is hand-rolled, so it is pinned against the standard bypass
 * catalogue rather than trusted by inspection.
 */
const TAB = String.fromCharCode(9);
const NL = String.fromCharCode(10);
const NUL = String.fromCharCode(0);

/** Control characters a browser strips from a URL before resolving its scheme. */
const CONTROL_CHARS = new RegExp(
  "[" + String.fromCharCode(0) + "-" + String.fromCharCode(32) + "]",
  "g",
);

const vectors: [string, string][] = [
  ["plain script", "<script>alert(1)</script>"],
  ["img onerror", "<img src=x onerror=alert(1)>"],
  ["img onerror quoted", '<img src="x" onerror="alert(1)">'],
  ["unterminated img", "<img src=x onerror=alert(1)"],
  ["href javascript", '<a href="javascript:alert(1)">x</a>'],
  ["href unquoted js", "<a href=javascript:alert(1)>x</a>"],
  ["href entity decimal", '<a href="&#106;avascript:alert(1)">x</a>'],
  ["href entity hex", '<a href="&#x6a;avascript:alert(1)">x</a>'],
  ["href entity semicolonless", '<a href="&#106avascript:alert(1)">x</a>'],
  ["href tab in scheme", '<a href="jav' + TAB + 'ascript:alert(1)">x</a>'],
  ["href newline in scheme", '<a href="jav' + NL + 'ascript:alert(1)">x</a>'],
  ["href nul in scheme", '<a href="jav' + NUL + 'ascript:alert(1)">x</a>'],
  ["href entity tab", '<a href="jav&#x09;ascript:alert(1)">x</a>'],
  ["svg onload", "<svg onload=alert(1)>"],
  ["nested script", "<scr<script>ipt>alert(1)</scr</script>ipt>"],
  ["style expression", '<style>body{background:url("javascript:alert(1)")}</style>'],
  ["iframe", '<iframe src="javascript:alert(1)"></iframe>'],
  ["object", '<object data="javascript:alert(1)"></object>'],
  ["form action", '<form action="javascript:alert(1)"><button>x</button></form>'],
  ["meta refresh", '<meta http-equiv="refresh" content="0;url=javascript:alert(1)">'],
  ["input autofocus", "<input autofocus onfocus=alert(1)>"],
  ["body onload", "<body onload=alert(1)>"],
  ["details ontoggle", "<details open ontoggle=alert(1)>"],
  ["data uri img", '<img src="data:text/html;base64,PHNjcmlwdD4=">'],
  ["case variation", "<ScRiPt>alert(1)</ScRiPt>"],
  ["backtick attr", "<img src=`x` onerror=alert(1)>"],
  ["single-quoted href", "<a href='javascript:alert(1)'>x</a>"],
  ["vbscript", '<a href="vbscript:msgbox(1)">x</a>'],
];

/** Approximates what a browser resolves an attribute value to. */
function decode(html: string): string {
  return html
    .replace(/&#x([0-9a-f]+);?/gi, (_m, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);?/g, (_m, dec) => String.fromCharCode(parseInt(dec, 10)))
    .replace(CONTROL_CHARS, "");
}

describe("sanitizeHtml against known bypass vectors", () => {
  for (const [name, input] of vectors) {
    it(name, () => {
      const out = sanitizeHtml(input);
      const lower = out.toLowerCase();

      expect(lower).not.toMatch(
        /<\s*(script|iframe|object|embed|svg|meta|form|body|input|details|style|link)\b/,
      );
      expect(lower).not.toMatch(/\son[a-z]+\s*=/);
      expect(decode(lower)).not.toMatch(/(href|src)=["']?(javascript|vbscript|data):/);
    });
  }
});

describe("sanitizeHtml keeps legitimate content", () => {
  const allowed: [string, string][] = [
    ["absolute https", '<a href="https://example.com/path?a=1&amp;b=2">x</a>'],
    ["absolute http", '<a href="http://example.com">x</a>'],
    ["root-relative", '<a href="/shop/hoodie">x</a>'],
    ["relative", '<a href="hoodie">x</a>'],
    ["anchor", '<a href="#care">x</a>'],
    ["mailto", '<a href="mailto:hi@example.com">x</a>'],
    ["tel", '<a href="tel:+15551234">x</a>'],
    ["image path", '<img src="/demo/products/insulated-bottle.svg" alt="Bottle">'],
    ["path with colon segment", '<a href="/notes/2026:review">x</a>'],
  ];

  for (const [name, input] of allowed) {
    it(name, () => {
      const out = sanitizeHtml(input);
      expect(out).toMatch(/(href|src)=/);
    });
  }

  it("keeps formatting and adds rel to new-tab links", () => {
    const out = sanitizeHtml(
      '<p>Soft <strong>cotton</strong> and <em>linen</em>.</p>' +
        '<ul><li>One</li></ul>' +
        '<a href="https://example.com" target="_blank">More</a>',
    );
    expect(out).toContain("<strong>");
    expect(out).toContain("<li>");
    expect(out).toContain('rel="noopener noreferrer"');
  });
});
