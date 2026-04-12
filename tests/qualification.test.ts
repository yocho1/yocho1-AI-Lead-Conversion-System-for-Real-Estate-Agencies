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
});
