import { describe, expect, it } from "vitest";
import { extractPreferredVisitDay, extractPreferredVisitPeriod } from "@/lib/appointment";
import {
  getRepeatedQuestionSafeVariant,
  getMissingQualificationFields,
  getNextQualificationQuestion,
  shouldEnterClosingMode,
} from "@/lib/sales-flow";

describe("sales flow", () => {
  it("detects missing qualification fields", () => {
    const missing = getMissingQualificationFields({ location: "Dubai" });
    expect(missing).toContain("budget");
    expect(missing).toContain("property type");
    expect(missing).toContain("timeline");
  });

  it("does not enter closing mode when mandatory fields are incomplete", () => {
    expect(
      shouldEnterClosingMode({ budget: "$500k", location: "Dubai Marina", buyingTimeline: "next month" }),
    ).toBe(false);
  });

  it("enters closing mode only when all mandatory fields exist", () => {
    expect(
      shouldEnterClosingMode({
        name: "Nadia Salem",
        email: "nadia@example.com",
        budget: "$500k",
        location: "Dubai Marina",
        propertyType: "apartment",
        buyingTimeline: "next month",
      }),
    ).toBe(true);
  });

  it("returns deterministic next qualification question", () => {
    const question = getNextQualificationQuestion(["budget", "location"]);
    expect(question?.toLowerCase()).toContain("budget");
  });

  it("provides alternate phrasing for repeated prompts", () => {
    const alt = getRepeatedQuestionSafeVariant("location");
    expect(alt.toLowerCase()).toContain("area");
  });
});

describe("appointment parser", () => {
  it("extracts preferred day and period", () => {
    expect(extractPreferredVisitDay("Tuesday works for me")).toBe("tuesday");
    expect(extractPreferredVisitPeriod("afternoon is best")).toBe("afternoon");
  });

  it("handles typo for tomorrow", () => {
    expect(extractPreferredVisitDay("tomorow works")).toBe("tomorrow");
  });

  it("can infer day and period from multi-turn text", () => {
    const history = "I am ready to visit. sunday works for me. morning please.";
    expect(extractPreferredVisitDay(history)).toBe("sunday");
    expect(extractPreferredVisitPeriod(history)).toBe("morning");
  });
});
