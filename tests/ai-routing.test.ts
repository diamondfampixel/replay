import { afterEach, describe, expect, it } from "vitest";
import {
  classifyMessage, decisionFor, higherTier, routeRequest, supportsEffort, tierForTool, tierFromHistory,
  DEFAULT_LIGHT_MODEL,
} from "@/lib/ai/routing";

const DEFAULT = "claude-sonnet-5";

afterEach(() => {
  delete process.env.AI_LIGHT_MODEL;
});

describe("request classification", () => {
  it("sends read-only business questions to the light tier", () => {
    for (const message of [
      "Give me a breakdown of my recent sales.",
      "What were my best sellers last month, and which products are low on stock?",
      "How many orders did we get this week?",
      "Which customers spent the most?",
      "any refunds lately?",
    ]) {
      expect(classifyMessage(message), message).toBe("light");
    }
  });

  it("sends store changes to the standard tier", () => {
    for (const message of [
      "Create a 15% discount code SUMMER15 for the next two weeks",
      "Refund order #1042",
      "Delete every product in the archive collection",
      "Put the wool beanie on sale for $19",
      "Fulfill all unfulfilled orders from yesterday",
    ]) {
      expect(classifyMessage(message), message).toBe("standard");
    }
  });

  it("sends design work to the design tier", () => {
    for (const message of [
      "Make my store feel like a premium streetwear brand — bold, dark, lots of movement.",
      "Redesign the homepage for a playful candy brand",
      "Change the fonts and colours to something more luxurious",
      "Make it more interesting",
      "Can you improve how the mobile layout looks?",
    ]) {
      expect(classifyMessage(message), message).toBe("design");
    }
  });

  it("keeps a short follow-up inside the previous turn's tier", () => {
    expect(classifyMessage("yes, do that", "design")).toBe("design");
    expect(classifyMessage("go ahead", "standard")).toBe("standard");
    expect(classifyMessage("thanks", "light")).toBe("light");
    // A long, clearly new question is routed on its own merits.
    expect(classifyMessage("What were my three best-selling products over the last thirty days, measured by revenue rather than units, and how do they compare to the month before?", "design")).toBe("light");
  });

  it("only ever escalates", () => {
    expect(higherTier("light", "design")).toBe("design");
    expect(higherTier("standard", "light")).toBe("standard");
    expect(tierForTool("list_products", "read")).toBe("light");
    expect(tierForTool("adjust_prices", "high")).toBe("standard");
    expect(tierForTool("compose_page", "high")).toBe("design");
    expect(tierFromHistory([{ id: "1", name: "get_analytics", input: {}, status: "executed", risk: "read" }])).toBe("light");
    expect(tierFromHistory([{ id: "1", name: "update_design_dna", input: {}, status: "pending", risk: "high" }])).toBe("design");
  });
});

describe("routing decisions", () => {
  it("uses the small model at the light tier and the default model with effort elsewhere", () => {
    const light = decisionFor("light", DEFAULT);
    expect(light.model).toBe(DEFAULT_LIGHT_MODEL);
    expect(light.effort).toBeNull();
    expect(light.maxTokens).toBeLessThan(decisionFor("design", DEFAULT).maxTokens);

    const standard = decisionFor("standard", DEFAULT);
    expect(standard.model).toBe(DEFAULT);
    expect(standard.effort).toBe("medium");

    const design = decisionFor("design", DEFAULT);
    expect(design.model).toBe(DEFAULT);
    expect(design.effort).toBe("high");
    expect(design.maxTokens).toBe(16000);
  });

  it("AI_LIGHT_MODEL=off keeps everything on the default model, at low effort for questions", () => {
    process.env.AI_LIGHT_MODEL = "off";
    const light = decisionFor("light", DEFAULT);
    expect(light.model).toBe(DEFAULT);
    expect(light.effort).toBe("low");
  });

  it("never sends effort to a model that rejects it", () => {
    expect(supportsEffort("claude-haiku-4-5")).toBe(false);
    expect(supportsEffort("claude-sonnet-5")).toBe(true);
    expect(supportsEffort("claude-opus-5")).toBe(true);
    process.env.AI_LIGHT_MODEL = "off";
    expect(decisionFor("design", "claude-haiku-4-5").effort).toBeNull();
  });

  it("routeRequest folds message and history together", () => {
    expect(routeRequest("What sold best?", DEFAULT).tier).toBe("light");
    expect(routeRequest("ok apply it", DEFAULT, [{ id: "1", name: "compose_page", input: {}, status: "pending", risk: "high" }]).tier).toBe("design");
  });
});
