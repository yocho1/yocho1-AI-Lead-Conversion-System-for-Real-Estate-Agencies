import { describe, expect, it } from "vitest";
import {
  getMandatoryCaptureMessage,
  hasEnoughMessagesForMandatoryGate,
  isMandatoryInfoMissing,
} from "@/lib/chat-flow";

describe("mandatory capture flow", () => {
  it("requires both name and contact when absent", () => {
    const missing = isMandatoryInfoMissing({ budget: "$500k" });
    const prompt = getMandatoryCaptureMessage({ budget: "$500k" });

    expect(missing).toBe(true);
    expect(prompt.toLowerCase()).toContain("full name");
    expect(prompt.toLowerCase()).toContain("phone number or email");
  });

  it("requires name when contact already exists", () => {
    const missing = isMandatoryInfoMissing({ email: "lead@example.com" });
    const prompt = getMandatoryCaptureMessage({ email: "lead@example.com" });

    expect(missing).toBe(true);
    expect(prompt.toLowerCase()).toContain("full name");
  });

  it("passes when both name and one contact method are present", () => {
    expect(isMandatoryInfoMissing({ name: "Nadia Salem", phone: "+97150000000" })).toBe(false);
  });

  it("requires full name, not first name only", () => {
    expect(isMandatoryInfoMissing({ name: "Achraf", email: "achraf@test.com" })).toBe(true);
    expect(isMandatoryInfoMissing({ name: "Achraf Lachgar", email: "achraf@test.com" })).toBe(false);
  });

  it("enforces gate after second user message", () => {
    expect(hasEnoughMessagesForMandatoryGate(1)).toBe(false);
    expect(hasEnoughMessagesForMandatoryGate(2)).toBe(true);
  });
});
