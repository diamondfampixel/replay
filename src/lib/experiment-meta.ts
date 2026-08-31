/** Shared between the experiments service and its client forms. */

export const TEST_TYPES = [
  { value: "headline", label: "Headline", target: "page", field: "headline" },
  { value: "hero", label: "Hero section", target: "page", field: "headline" },
  { value: "cta", label: "Call to action", target: "page", field: "ctaLabel" },
  { value: "section", label: "Landing page section", target: "page", field: "heading" },
  { value: "page", label: "Whole page variation", target: "page", field: "sections" },
  { value: "product_title", label: "Product title", target: "product", field: "title" },
  { value: "product_description", label: "Product description", target: "product", field: "description" },
  { value: "product_image", label: "Product image", target: "product", field: "imageUrl" },
  { value: "price_display", label: "Price display note", target: "product", field: "priceNote" },
] as const;

export const GOALS = [
  { value: "purchase", label: "Purchase" },
  { value: "add_to_cart", label: "Add to cart" },
  { value: "checkout_started", label: "Checkout started" },
  { value: "email_signup", label: "Email signup" },
] as const;

export function testTypeMeta(value: string) {
  return TEST_TYPES.find((type) => type.value === value) ?? TEST_TYPES[0];
}
