/**
 * Advanced escape hatch: merchant CSS, scoped to the storefront root.
 *
 * CSS cannot execute script, but it can exfiltrate (url()/@import), escape
 * the storefront (html/body selectors, position:fixed overlays are allowed but
 * scoping keeps it inside .st-root), or be unbounded. We strip the dangerous
 * constructs, cap the size, and wrap the result in a nesting block so every
 * rule applies only inside `.st-root` — the editor chrome can never be
 * affected, and one tenant's CSS never reaches another's page (it is stored
 * on and rendered for that store only).
 */
export const CUSTOM_CSS_MAX = 20_000;

export type CustomCssResult = { css: string; warnings: string[] };

export function sanitizeCustomCss(input: string | null | undefined): CustomCssResult {
  const warnings: string[] = [];
  let css = (input ?? "").replace(/\r/g, "");
  if (!css.trim()) return { css: "", warnings };

  if (css.length > CUSTOM_CSS_MAX) {
    css = css.slice(0, CUSTOM_CSS_MAX);
    warnings.push(`Custom CSS is limited to ${CUSTOM_CSS_MAX.toLocaleString()} characters; the rest was dropped.`);
  }

  // Never allow the style block to be closed or script-ish content smuggled.
  css = css.replace(/<\s*\/?\s*(style|script)/gi, () => { warnings.push("Tags are not allowed in CSS."); return ""; });

  // No remote loads: @import and url() can leak visitor data to third parties.
  if (/@import/i.test(css)) { warnings.push("@import is not allowed."); css = css.replace(/@import[^;]*;?/gi, ""); }
  if (/url\s*\(/i.test(css)) {
    warnings.push("url() is not allowed; upload images through Media and use them in sections.");
    css = css.replace(/url\s*\([^)]*\)/gi, "none");
  }
  // Legacy IE expressions / javascript: schemes / behaviors.
  css = css.replace(/expression\s*\(/gi, "invalid(").replace(/javascript\s*:/gi, "invalid:").replace(/behavior\s*:/gi, "invalid:");
  // @charset/@namespace/@font-face with remote sources add nothing here.
  css = css.replace(/@(charset|namespace|font-face)[^{;]*(\{[^}]*\}|;)/gi, "");

  // Comments go first: a brace hidden inside one must not be counted by the
  // balancer below and then vanish, leaving a stray `}` that escapes the scope.
  css = css.replace(/\/\*[\s\S]*?\*\//g, "");

  // Containment: a stray `}` would close the scoping block and let the rest of
  // the sheet run unscoped. Drop any closing brace that has no opener, and
  // close any that are left open, so the wrapper always holds.
  let depth = 0;
  let balanced = "";
  for (const ch of css) {
    if (ch === "{") depth += 1;
    else if (ch === "}") { if (depth === 0) { warnings.push("Unbalanced `}` removed."); continue; } depth -= 1; }
    balanced += ch;
  }
  if (depth > 0) { balanced += "}".repeat(depth); warnings.push("Unclosed block auto-closed."); }
  css = balanced;

  // Scope: wrap in a nesting block. Selectors like `html`/`body` become
  // `.st-root html`, which matches nothing — the storefront root is the ceiling.
  return { css: `.st-root {\n${css}\n}`, warnings };
}
