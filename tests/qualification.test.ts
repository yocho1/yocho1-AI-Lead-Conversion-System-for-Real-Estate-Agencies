import { describe, expect, it } from "vitest";
import { classifyLead } from "@/lib/qualification";
import { extractLeadSignals } from "@/lib/lead-parser";

describe("lead qualification", () => {
  it("classifies complete urgent leads as hot", () => {
    const status = classifyLead({
      budget: "$500k",
      location: "Dubai Marina",
      propertyType: "apartment",
      buyingTimeline: "asap",
      email: "lead@example.com",
    });

    expect(status).toBe("hot");
  });

  it("classifies partial leads as warm", () => {
    const status = classifyLead({
      budget: "$300k",
      location: "Abu Dhabi",
      propertyType: "villa",
    });

    expect(status).toBe("warm");
  });

  it("classifies weak leads as cold", () => {
    const status = classifyLead({
      location: "Ajman",
    });

    expect(status).toBe("cold");
  });
});

describe("lead parser", () => {
  it("extracts core signals from free text", () => {
    const raw = "Hi, I'm Sarah. Budget is $450k for an apartment in downtown. My email is sarah@mail.com and I want to buy next month.";
    const signals = extractLeadSignals(raw);

    expect(signals.name?.toLowerCase()).toContain("sarah");
    expect(signals.budget).toBe("$450k");
    expect(signals.location?.toLowerCase()).toContain("downtown");
    expect(signals.email).toBe("sarah@mail.com");
  });

  it("extracts full name from comma-separated contact input", () => {
    const raw = "achraf lachgar, achraf@gmail.com, 0674332123";
    const signals = extractLeadSignals(raw);

    expect(signals.name?.toLowerCase()).toBe("achraf lachgar");
    expect(signals.email).toBe("achraf@gmail.com");
    expect(signals.phone).toContain("0674332123");
  });

  it("extracts standalone location replies", () => {
    expect(extractLeadSignals("france").location?.toLowerCase()).toBe("france");
    expect(extractLeadSignals("paris").location?.toLowerCase()).toBe("paris");
  });

  it("extracts timeline from short buyer intent replies", () => {
    expect(extractLeadSignals("buy").buyingTimeline).toBe("soon");
    expect(extractLeadSignals("I wanna buy").buyingTimeline).toBe("soon");
    expect(extractLeadSignals("move").buyingTimeline).toBe("soon");
  });

  it("does not parse phone numbers as budget", () => {
    const signals = extractLeadSignals("0675432345");
    expect(signals.budget).toBeUndefined();
  });

  it("allows one-word standalone location but rejects multi-word names", () => {
    expect(extractLeadSignals("france").location?.toLowerCase()).toBe("france");
    expect(extractLeadSignals("achraf lachgar").location).toBeUndefined();
  });

  it("extracts location correctly from '<location> and <budget>' format", () => {
    const signals = extractLeadSignals("spain and 700K");
    expect(signals.location?.toLowerCase()).toBe("spain");
  });

  it("does not parse confirmation words as location", () => {
    expect(extractLeadSignals("okay").location).toBeUndefined();
    expect(extractLeadSignals("ok").location).toBeUndefined();
  });
});
