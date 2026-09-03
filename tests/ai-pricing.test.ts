import { describe, expect, it } from "vitest";
import { estimateCostMicros, formatUsd, microsToUsd, priceFor, MODEL_PRICES } from "@/lib/ai/pricing";

describe("model pricing", () => {
  it("matches dated model ids to their family and prices unknown models as Sonnet", () => {
    expect(priceFor("claude-haiku-4-5-20251001")).toBe(MODEL_PRICES["claude-haiku-4-5"]);
    expect(priceFor("claude-sonnet-5")).toBe(MODEL_PRICES["claude-sonnet-5"]);
    expect(priceFor("some-future-model")).toBe(MODEL_PRICES["claude-sonnet-5"]);
  });

  it("reproduces the live verification bill from its token counts", () => {
    // 14 real assistant actions measured through Halyard: ≈ $0.63 at list prices.
    const micros = estimateCostMicros("claude-sonnet-5", {
      inputTokens: 70,
      outputTokens: 20_412,
      cacheReadTokens: 839_082,
      cacheWriteTokens: 102_320,
    });
    expect(microsToUsd(micros)).toBeCloseTo(0.628, 2);
    expect(formatUsd(micros)).toBe("$0.63");
  });

  it("prices the light model at a fraction of the default", () => {
    const usage = { inputTokens: 200, outputTokens: 800, cacheReadTokens: 9000, cacheWriteTokens: 0 };
    const sonnet = estimateCostMicros("claude-sonnet-5", usage);
    const haiku = estimateCostMicros("claude-haiku-4-5", usage);
    expect(haiku * 2).toBe(sonnet);
  });

  it("is integer micro-dollars", () => {
    expect(Number.isInteger(estimateCostMicros("claude-sonnet-5", { inputTokens: 1, outputTokens: 1 }))).toBe(true);
    expect(estimateCostMicros("claude-sonnet-5", {})).toBe(0);
  });
});
