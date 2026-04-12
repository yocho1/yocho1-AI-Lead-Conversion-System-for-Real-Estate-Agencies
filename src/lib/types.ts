export type LeadStatus = "hot" | "warm" | "cold";

export type ChatRole = "user" | "assistant";

export interface Agency {
  id: string;
  name: string;
  api_key: string;
  created_at: string;
}

export interface Lead {
  id: string;
  agency_id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  budget: string | null;
  location: string | null;
  property_type: string | null;
  buying_timeline: string | null;
  status: LeadStatus;
  created_at: string;
}

export interface Message {
  id: string;
  lead_id: string;
  role: ChatRole;
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
