"use client";

import { useEffect, useState } from "react";

type Lead = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  budget: string | null;
  location: string | null;
  property_type: string | null;
  buying_timeline: string | null;
  status: "hot" | "warm" | "cold";
  created_at: string;
};

type ConversationMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
};

function renderMessageContent(content: string) {
  const parts = content.split(/(https?:\/\/\S+)/g);

  return parts.map((part, index) => {
    const isLink = /^https?:\/\//.test(part);
    if (!isLink) {
      return <span key={`text-${index}`}>{part}</span>;
    }

    return (
      <a
        key={`link-${index}`}
        href={part}
        target="_blank"
        rel="noreferrer"
        style={{ color: "#0f766e", textDecoration: "underline", wordBreak: "break-all" }}
      >
        {part}
      </a>
    );
  });
}

export function LeadsBoard({ agencyApiKey }: { agencyApiKey: string }) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLeads = async () => {
      setLoading(true);
      const response = await fetch(`/api/leads?agencyApiKey=${agencyApiKey}`);
      const data = await response.json();
      setLeads(data.leads || []);
      setLoading(false);
    };

    void fetchLeads();
  }, [agencyApiKey]);

  useEffect(() => {
    if (!selectedLeadId) return;

    const fetchMessages = async () => {
      const response = await fetch(`/api/leads/${selectedLeadId}/messages?agencyApiKey=${agencyApiKey}`);
      const data = await response.json();
      setMessages(data.messages || []);
    };

    void fetchMessages();
  }, [selectedLeadId, agencyApiKey]);

  return (
    <section className="leads-grid">
      <div className="card" style={{ overflowX: "auto" }}>
        <h3 style={{ marginTop: 0 }}>Leads</h3>
        {loading ? (
          <p>Loading leads...</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.92rem" }}>
            <thead>
              <tr style={{ textAlign: "left", color: "#4c617a" }}>
                <th style={{ paddingBottom: "0.6rem" }}>Name</th>
                <th>Status</th>
                <th>Location</th>
                <th>Budget</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr
                  key={lead.id}
                  onClick={() => setSelectedLeadId(lead.id)}
                  style={{
                    borderTop: "1px solid #edf1f7",
                    cursor: "pointer",
                    background: selectedLeadId === lead.id ? "#f1f7ff" : "transparent",
                  }}
                >
                  <td style={{ padding: "0.65rem 0" }}>{lead.name || "Unknown"}</td>
                  <td>
                    <span className={`badge badge-${lead.status}`}>{lead.status}</span>
                  </td>
                  <td style={{ maxWidth: "220px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={lead.location || "-"}>
                    {lead.location || "-"}
                  </td>
                  <td>{lead.budget || "-"}</td>
                  <td>{new Date(lead.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card" style={{ minHeight: "420px" }}>
        <h3 style={{ marginTop: 0 }}>Conversation</h3>
        {!selectedLeadId && <p style={{ color: "#4c617a" }}>Select a lead to see conversation history.</p>}
        {selectedLeadId && (
          <div className="conversation-scroll" style={{ display: "grid", gap: "0.55rem" }}>
            {messages.map((message) => (
              <div
                key={message.id}
                style={{
                  justifySelf: message.role === "user" ? "end" : "start",
                  maxWidth: "100%",
                  background: message.role === "user" ? "#d8f4ef" : "#eef2ff",
                  borderRadius: "11px",
                  padding: "0.55rem 0.7rem",
                  overflowWrap: "anywhere",
                  wordBreak: "break-word",
                }}
              >
                <div style={{ fontSize: "0.8rem", color: "#4c617a", marginBottom: "0.2rem" }}>{message.role}</div>
                <div style={{ fontSize: "0.9rem", lineHeight: 1.45 }}>{renderMessageContent(message.content)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
