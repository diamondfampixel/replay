/**
 * Drives a real purchase through a real browser against a running server.
 *
 * The Vitest suite covers the services; this covers the wiring between them and
 * the UI — variant selection, the cart drawer, discount entry, and the checkout
 * form actually producing an order.
 *
 *   npm run build && npm start &
 *   node scripts/smoke-purchase.mjs [baseUrl] [storeSlug]
 */
import { chromium } from "playwright";

const baseUrl = process.argv[2] ?? "http://localhost:3000";
const storeSlug = process.argv[3] ?? "northwind-supply-co";
const store = `${baseUrl}/s/${storeSlug}`;

const failures = [];
function check(label, condition, detail = "") {
  const ok = Boolean(condition);
  if (!ok) failures.push(label);
  console.log(`${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
}

const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined,
});
const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
page.on("pageerror", (error) => failures.push(`page error: ${error.message}`));

try {
  // 1. A product page renders with its options.
  await page.goto(`${store}/products/essential-hoodie`, { waitUntil: "networkidle" });
  const title = await page.locator("h1").first().innerText();
  check("product page renders", !/something went wrong/i.test(title), title);

  const options = page.locator("button[aria-pressed]");
  const optionCount = await options.count();
  check("variant options render", optionCount > 0, `${optionCount} buttons`);
  for (let i = 0; i < optionCount; i++) {
    const className = (await options.nth(i).getAttribute("class")) ?? "";
    if (!className.includes("line-through")) await options.nth(i).click();
  }

  // 2. Adding to cart opens the drawer with the item in it.
  await page.getByRole("button", { name: /add to cart|add to bag/i }).click();
  await page.waitForTimeout(1500);
  const drawer = await page
    .locator('h2:has-text("Your cart")')
    .first()
    .innerText()
    .catch(() => "");
  check("add to cart opens the drawer", /your cart \(\d+\)/i.test(drawer), drawer);

  // 3. A discount code is accepted and changes the total.
  await page.goto(`${store}/cart`, { waitUntil: "networkidle" });
  await page.fill("#discount", "WELCOME10");
  await page.getByRole("button", { name: "Apply" }).click();
  await page.waitForTimeout(1500);
  const summary = await page.locator("aside").first().innerText();
  check("discount code applies", /applied\./i.test(summary));

  // 4. Checkout produces an order.
  await page.goto(`${store}/checkout`, { waitUntil: "networkidle" });
  await page.fill('input[type="email"]', `smoke-${Date.now()}@example.test`);
  await page.fill("input[autocomplete='name']", "Smoke Tester");
  await page.fill("input[autocomplete='address-line1']", "12 Test Street");
  await page.fill("input[autocomplete='address-level2']", "Portland");
  await page.fill("input[autocomplete='address-level1']", "OR");
  await page.fill("input[autocomplete='postal-code']", "97209");
  await page.getByRole("button", { name: /place order/i }).click();
  await page.waitForURL(/\/orders\//, { timeout: 25_000 });

  const confirmation = await page.locator("h1").first().innerText();
  check("checkout creates an order", /order #\d+ is confirmed/i.test(confirmation), confirmation);
} finally {
  await browser.close();
}

if (failures.length) {
  console.error(`\n${failures.length} check(s) failed`);
  process.exit(1);
}
console.log("\nAll checks passed");
