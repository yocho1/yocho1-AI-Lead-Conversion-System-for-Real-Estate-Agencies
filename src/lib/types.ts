export type LeadStatus = "hot" | "warm" | "cold";

export type ChatRole = "user" | "assistant";

export interface Agency {
  id: string;
  name: string;
  api_key: string;
  primary_color: string | null;
  logo_url: string | null;
  created_at: string;
}

export interface Lead {
  id: string;
  agency_id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  budget: string | null;
  budget_value: number | null;
  location: string | null;
  property_type: string | null;
  buying_timeline: string | null;
  preferred_visit_day: string | null;
  preferred_visit_period: string | null;
  appointment_status: "not_set" | "pending" | "reserved";
  hot_alert_sent: boolean;
  chat_locked: boolean;
  lead_state: LeadState;
  status: LeadStatus;
  created_at: string;
}

export interface Message {
  id: string;
  agency_id: string;
  lead_id: string;
  role: ChatRole;
  sender?: "user" | "ai" | "agent";
  content: string;
  timestamp: string;
}

export interface LeadSignals {
  name?: string;
  email?: string;
  phone?: string;
  budget?: string;
  location?: string;
  propertyType?: string;
  buyingTimeline?: string;
}

export interface LeadState {
  id: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  contact: string | null;
  budget: number | null;
  currency: string | null;
  location: {
    raw: string | null;
    city: string | null;
    country: string | null;
  };
  property_type: string | null;
  timeline: string | null;
  timeline_normalized: string | null;
  status: "new" | "cold" | "warm" | "hot" | "booked";
  stage: "collecting" | "closing" | "booked";
  last_question: LeadFieldKey | null;
  created_at: string;
}

export type LeadFieldKey = "location" | "budget" | "property_type" | "timeline" | "name" | "contact";
