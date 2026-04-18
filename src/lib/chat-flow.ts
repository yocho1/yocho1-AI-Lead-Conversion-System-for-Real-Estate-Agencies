import type { LeadSignals } from "@/lib/types";

function hasFullName(name?: string) {
  if (!name) return false;
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean).length >= 2;
}

export function isMandatoryInfoMissing(signals: LeadSignals) {
  return !hasFullName(signals.name) || !(signals.email || signals.phone);
}

export function getMandatoryCaptureMessage(signals: LeadSignals) {
  const missingName = !signals.name;
  const missingContact = !(signals.email || signals.phone);

  if (missingName && missingContact) {
    return "Before we continue, please share your full name and either your phone number or email so I can reserve options for you.";
  }

  if (missingName) {
    return "Great, I just need your full name to continue with matching and booking your visit.";
  }

  return "Great, I just need your phone number or email to continue and secure relevant property options for you.";
}

export function hasEnoughMessagesForMandatoryGate(userMessageCount: number) {
  return userMessageCount >= 2;
}
