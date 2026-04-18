import { describe, expect, it } from "vitest";
import {
  applyUserInputToState,
  getInvalidFieldMessage,
  getQuestionForField,
  hasAllMandatoryFields,
} from "@/lib/conversation-engine";
import { createInitialLeadState, normalizeBudget, normalizeContact, normalizeLocation, normalizeName } from "@/lib/validation";

describe("validation layer", () => {
  it("normalizes budget values", () => {
    expect(normalizeBudget("50k")).toEqual({ ok: true, value: { value: 50000, currency: "USD" } });
    expect(normalizeBudget("500000")).toEqual({ ok: true, value: { value: 500000, currency: "USD" } });
    expect(normalizeBudget("500 000")).toEqual({ ok: true, value: { value: 500000, currency: "USD" } });
  });

  it("rejects malformed names and locations", () => {
    expect(normalizeName("okay").ok).toBe(false);
    expect(normalizeLocation("franceee").ok).toBe(false);
    expect(normalizeLocation("Dubai").ok).toBe(true);
  });

  it("accepts valid contact and rejects invalid contact", () => {
    expect(normalizeContact("lead@example.com").ok).toBe(true);
    expect(normalizeContact("not-a-contact").ok).toBe(false);
  });

  it("accepts mixed city/country input", () => {
    const result = normalizeLocation("morocco, casablanca");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.city).toBe("Casablanca");
      expect(result.value.country).toBe("Morocco");
    }
  });
});

describe("conversation engine", () => {
  it("asks next required field without looping", () => {
    const state = createInitialLeadState();
    const firstTurn = applyUserInputToState(state, "hi");
    expect(firstTurn.invalidField).toBe("location");
    expect(getQuestionForField("location").toLowerCase()).toContain("city");
  });

  it("returns invalid field when expected input is malformed", () => {
    const state = {
      ...createInitialLeadState(),
      location: {
        raw: "Dubai",
        city: "Dubai",
        country: "United Arab Emirates",
      },
    };
    const turn = applyUserInputToState(state, "abc");
    expect(turn.invalidField).toBeNull();
    expect(getInvalidFieldMessage("budget").toLowerCase()).toContain("budget");
  });

  it("reaches complete state after all required fields", () => {
    let state = createInitialLeadState();

    state = applyUserInputToState(state, "Dubai").state;
    state = applyUserInputToState(state, "500k").state;
    state = applyUserInputToState(state, "apartment").state;
    state = applyUserInputToState(state, "asap").state;
    state = applyUserInputToState(state, "Nadia Salem").state;
    state = applyUserInputToState(state, "nadia@example.com").state;

    expect(hasAllMandatoryFields(state)).toBe(true);
    expect(state.timeline_normalized).toBe("asap");
    expect(state.stage).toBe("closing");
  });

  it("maps timeline aliases like next day and this day to asap", () => {
    let state = createInitialLeadState();
    state = applyUserInputToState(state, "Rabat").state;
    state = applyUserInputToState(state, "200k").state;
    state = applyUserInputToState(state, "villa").state;
    state = applyUserInputToState(state, "next day").state;
    expect(state.timeline_normalized).toBe("asap");
  });
});
