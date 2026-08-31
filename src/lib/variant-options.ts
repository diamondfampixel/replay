export type VariantLike = { title: string; options: Record<string, string> };
export type OptionAxis = { name: string; values: string[] };

/**
 * Reconstructs the option axes from a product's variants, in the order the
 * operator defined them.
 *
 * Variant options are stored as `jsonb`, and Postgres does not preserve key
 * order — it sorts by key length then alphabetically, which would show "Size"
 * before "Colour". The variant title ("Black / Small") does preserve the
 * original order, so it is used to sort the axes back into place.
 */
export function deriveOptionAxes(variants: VariantLike[]): OptionAxis[] {
  const byName = new Map<string, string[]>();
  for (const variant of variants) {
    for (const [name, value] of Object.entries(variant.options ?? {})) {
      const values = byName.get(name) ?? [];
      if (!values.includes(value)) values.push(value);
      byName.set(name, values);
    }
  }
  if (byName.size < 2) {
    return [...byName.entries()].map(([name, values]) => ({ name, values }));
  }

  // Position each axis by where its value appears in a variant's title.
  const reference = variants.find((variant) => variant.title.includes(" / ")) ?? variants[0];
  const parts = reference.title.split(" / ").map((part) => part.trim());
  const order = new Map<string, number>();
  for (const [name] of byName) {
    const value = reference.options?.[name];
    const index = value ? parts.indexOf(value) : -1;
    order.set(name, index === -1 ? Number.MAX_SAFE_INTEGER : index);
  }

  return [...byName.entries()]
    .sort((a, b) => (order.get(a[0]) ?? 0) - (order.get(b[0]) ?? 0))
    .map(([name, values]) => ({ name, values }));
}
