"use client";

import { useEffect, useState } from "react";
import { Phone, Flag, Trash2, Clock3, Bot } from "lucide-react";
import { SurfaceCard } from "@/components/ui/surface-card";
import { AppButton } from "@/components/ui/button";

type Lead = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  budget: string | null;
  budget_value: number | null;
  location: string | null;
  property_type: string | null;
  buying_timeline: string | null;
  appointment_status: "not_set" | "pending" | "reserved";
  status: "hot" | "warm" | "cold";
  hot_alert_sent: boolean;
  chat_locked: boolean;
  last_message_at: string;
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
  let cursor = 0;

  return parts.map((part) => {
    const key = `${cursor}-${part.slice(0, 16)}`;
    cursor += part.length;
    const isLink = /^https?:\/\//.test(part);
    if (!isLink) {
      return <span key={`text-${key}`}>{part}</span>;
    }

    return (
      <a
        key={`link-${key}`}
        href={part}
        target="_blank"
        rel="noreferrer"
        style={{ color: "var(--secondary)", textDecoration: "underline", wordBreak: "break-all" }}
      >
        {part}
      </a>
    );
  });
}

function formatLastActivity(value: string) {
  const date = new Date(value);
  return {
    day: date.toLocaleDateString([], { day: "2-digit", month: "short" }),
    time: date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
  };
}

function getDisplayLeadName(lead: Lead) {
  const rawName = (lead.name || "").trim();
  if (!rawName) return "Unknown";

  const rawLocation = (lead.location || "").trim();
  if (rawLocation && rawName.toLowerCase() === rawLocation.toLowerCase()) {
    return "Unknown";
  }

  return rawName;
}

export function LeadsBoard({ agencyApiKey, demoMode = false }: Readonly<{ agencyApiKey: string; demoMode?: boolean }>) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingLeadId, setDeletingLeadId] = useState<string | null>(null);
  const [searchValue, setSearchValue] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "hot" | "warm" | "cold" | "booked">("all");
  const [nowTs] = useState(() => Date.now());

  const getDisplayStatus = (lead: Lead) => (lead.appointment_status === "reserved" ? "booked" : lead.status);

  const deleteLead = async (leadId: string) => {
    const confirmed = globalThis.confirm("Are you sure you want to delete this lead?");
    if (!confirmed) return;

    setDeletingLeadId(leadId);
    try {
      const response = await fetch(`/api/leads/${leadId}?agencyApiKey=${agencyApiKey}`, {
        method: "DELETE",
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Unable to delete lead");
      }

      setLeads((prev) => prev.filter((lead) => lead.id !== leadId));
      if (selectedLeadId === leadId) {
        setSelectedLeadId(null);
        setMessages([]);
      }
    } catch {
      globalThis.alert("Unable to delete lead. Please try again.");
    } finally {
      setDeletingLeadId(null);
    }
  };

  useEffect(() => {
    const fetchLeads = async (withLoader = false) => {
      if (withLoader) {
        setLoading(true);
      }
      const response = await fetch(`/api/leads?agencyApiKey=${agencyApiKey}&demo=${demoMode ? "true" : "false"}`);
      const data = await response.json();
      setLeads(data.leads || []);
      if (withLoader) {
        setLoading(false);
      }
    };

    void fetchLeads(true);

    const intervalId = setInterval(() => {
      void fetchLeads();
    }, 10000);

    return () => {
      clearInterval(intervalId);
    };
  }, [agencyApiKey, demoMode]);

  useEffect(() => {
    if (!selectedLeadId) return;

    const fetchMessages = async () => {
      const response = await fetch(`/api/leads/${selectedLeadId}/messages?agencyApiKey=${agencyApiKey}`);
      const data = await response.json();
      setMessages(data.messages || []);
    };

    void fetchMessages();
  }, [selectedLeadId, agencyApiKey]);

  const filteredLeads = leads.filter((lead) => {
    const statusMatch = statusFilter === "all" || getDisplayStatus(lead) === statusFilter;
    const blob = [lead.name, lead.email, lead.phone, lead.location, lead.budget, lead.property_type].filter(Boolean).join(" ").toLowerCase();
    const searchMatch = searchValue.trim().length === 0 || blob.includes(searchValue.trim().toLowerCase());
    return statusMatch && searchMatch;
  });

  const getRowBackground = (lead: Lead) => {
    if (selectedLeadId === lead.id) return "color-mix(in srgb, var(--surface-3) 85%, var(--surface))";
    return "transparent";
  };

  const toggleLeadStatus = (leadId: string) => {
    setLeads((prev) =>
      prev.map((item) => {
        if (item.id !== leadId) return item;
        return {
          ...item,
          status: item.status === "hot" ? "warm" : "hot",
        };
      }),
    );
  };

  const onCallClick = (lead: Lead) => {
    if (!lead.phone) return;
    globalThis.location.href = `tel:${lead.phone}`;
  };

  const onMarkClick = (event: React.MouseEvent, leadId: string) => {
    event.stopPropagation();
    toggleLeadStatus(leadId);
  };

  const onDeleteClick = (event: React.MouseEvent, leadId: string) => {
    event.stopPropagation();
    void deleteLead(leadId);
  };

  const loadingSkeletonRows = ["lead-skel-a", "lead-skel-b", "lead-skel-c", "lead-skel-d", "lead-skel-e"];
  const selectedLead = leads.find((lead) => lead.id === selectedLeadId) || null;

  const toneClass = (status: Lead["status"] | "booked") => {
    if (status === "booked") return "status-badge status-booked";
    if (status === "hot") return "status-badge status-hot";
    if (status === "warm") return "status-badge status-warm";
    return "status-badge status-cold";
  };

  const statusText = (status: Lead["status"] | "booked") => status.toUpperCase();

  return (
    <section className="grid gap-[1.15rem] lg:grid-cols-[minmax(0,1.35fr)_minmax(340px,1fr)]">
      <SurfaceCard className="overflow-hidden p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h3 className="m-0 text-[1.02rem] font-semibold">Leads Pipeline</h3>
          <div className="flex flex-wrap gap-2">
            <input
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
              placeholder="Search lead, location, budget"
              className="input"
              style={{ minWidth: "220px" }}
            />
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)} className="select" style={{ width: "130px" }}>
              <option value="all">All</option>
              <option value="hot">Hot</option>
              <option value="warm">Warm</option>
              <option value="cold">Cold</option>
              <option value="booked">Booked</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="grid gap-2">
            {loadingSkeletonRows.map((rowKey) => (
              <div key={rowKey} className="skeleton" style={{ height: "36px" }} />
            ))}
          </div>
        ) : (
          <>
            <div className="hidden lg:block">
              <table className="w-full table-fixed border-separate border-spacing-y-2 text-left text-[0.9rem]">
                <thead>
                  <tr className="text-[var(--text-soft)]">
                    <th className="w-[18%] px-3 text-xs font-semibold uppercase tracking-[0.04em]">Name</th>
                    <th className="w-[10%] px-3 text-xs font-semibold uppercase tracking-[0.04em]">Status</th>
                    <th className="w-[20%] px-3 text-xs font-semibold uppercase tracking-[0.04em]">Location</th>
                    <th className="w-[12%] px-3 text-xs font-semibold uppercase tracking-[0.04em]">Budget</th>
                    <th className="w-[10%] px-3 text-xs font-semibold uppercase tracking-[0.04em]">Timeline</th>
                    <th className="w-[14%] px-3 text-xs font-semibold uppercase tracking-[0.04em]">Last Activity</th>
                    <th className="w-[16%] px-3 text-xs font-semibold uppercase tracking-[0.04em] text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLeads.map((lead) => {
                    const lastSeen = formatLastActivity(lead.last_message_at || lead.created_at);
                    const displayStatus = getDisplayStatus(lead);
                    return (
                    <tr
                      key={lead.id}
                      data-status={displayStatus}
                      className={`table-row cursor-pointer rounded-xl border border-[var(--border)] bg-[color:color-mix(in_srgb,var(--surface-2)_72%,transparent)] ${
                        displayStatus === "hot" ? "table-row-hot-glow" : ""
                      }`}
                      onClick={() => setSelectedLeadId(lead.id)}
                      style={{ background: getRowBackground(lead) }}
                    >
                      <td className="px-3 py-2.5 font-semibold">
                        {getDisplayLeadName(lead)}
                        {nowTs - new Date(lead.created_at).getTime() < 1000 * 60 * 20 && (
                          <span className="ml-2 rounded-full border border-[color:color-mix(in_srgb,var(--secondary)_45%,transparent)] bg-[color:color-mix(in_srgb,var(--secondary)_16%,transparent)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.05em] text-[var(--primary)]">
                            New
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={toneClass(displayStatus)}>{statusText(displayStatus)}</span>
                      </td>
                      <td className="truncate px-3 py-2.5 text-[var(--text-soft)]" title={lead.location || "-"}>
                        {lead.location || "-"}
                      </td>
                      <td className="px-3 py-2.5 text-[1.02rem] font-extrabold tracking-[-0.01em] text-[var(--text)]">
                        {lead.budget_value ? `$${lead.budget_value.toLocaleString()}` : lead.budget || "-"}
                      </td>
                      <td className="px-3 py-2.5 text-[var(--text-soft)]">{lead.buying_timeline || "-"}</td>
                      <td className="px-3 py-2.5 text-[var(--text-soft)]">
                        <div className="leading-tight">
                          <div className="text-[13px] font-medium text-[var(--text)]">{lastSeen.day}</div>
                          <div className="text-[12px]">{lastSeen.time}</div>
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                          <AppButton
                            variant="primary"
                            className="inline-flex h-8 w-8 items-center justify-center p-0"
                            onClick={() => onCallClick(lead)}
                            disabled={!lead.phone}
                            aria-label="Call lead"
                            title="Call"
                          >
                            <Phone size={14} />
                          </AppButton>
                          <AppButton
                            variant="secondary"
                            className="ai-action-btn inline-flex h-8 w-8 items-center justify-center p-0"
                            onClick={(event) => onMarkClick(event, lead.id)}
                            aria-label="Mark lead"
                            title="Mark"
                          >
                            <Flag size={14} />
                          </AppButton>
                          <AppButton
                            variant="ghost-danger"
                            className="inline-flex h-8 w-8 items-center justify-center p-0"
                            onClick={(event) => onDeleteClick(event, lead.id)}
                            disabled={deletingLeadId === lead.id}
                            aria-label={deletingLeadId === lead.id ? "Deleting lead" : "Delete lead"}
                            title={deletingLeadId === lead.id ? "Deleting" : "Delete"}
                          >
                            <Trash2 size={14} />
                          </AppButton>
                        </div>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="grid gap-2 lg:hidden">
              {filteredLeads.map((lead) => {
                const displayStatus = getDisplayStatus(lead);
                return (
                  <article
                    key={`mobile-${lead.id}`}
                    data-status={displayStatus}
                    className={`table-row rounded-2xl border border-[var(--border)] bg-[color:color-mix(in_srgb,var(--surface-2)_76%,transparent)] p-3 text-left ${
                      displayStatus === "hot" ? "table-row-hot-glow" : ""
                    }`}
                  >
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <h4 className="m-0 text-sm font-semibold">{getDisplayLeadName(lead)}</h4>
                      <span className={toneClass(displayStatus)}>{statusText(displayStatus)}</span>
                    </div>
                    <div className="grid gap-1 text-sm text-[var(--text-soft)]">
                      <div>
                        <strong className="text-[var(--text)]">Budget:</strong>{" "}
                        <span className="text-[1rem] font-extrabold tracking-[-0.01em] text-[var(--text)]">
                          {lead.budget_value ? `$${lead.budget_value.toLocaleString()}` : lead.budget || "-"}
                        </span>
                      </div>
                      <div><strong className="text-[var(--text-soft)]">Location:</strong> {lead.location || "-"}</div>
                      <div><strong className="text-[var(--text)]">Timeline:</strong> {lead.buying_timeline || "-"}</div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      <AppButton variant="secondary" className="inline-flex items-center gap-1" onClick={() => setSelectedLeadId(lead.id)}>
                        Open
                      </AppButton>
                      <AppButton variant="primary" className="inline-flex items-center gap-1" onClick={() => onCallClick(lead)} disabled={!lead.phone}>
                        <Phone size={13} /> Call
                      </AppButton>
                      <AppButton variant="secondary" className="ai-action-btn inline-flex items-center gap-1" onClick={(event) => onMarkClick(event, lead.id)}>
                        <Flag size={13} /> Mark
                      </AppButton>
                      <AppButton variant="ghost-danger" className="inline-flex items-center gap-1" onClick={(event) => onDeleteClick(event, lead.id)} disabled={deletingLeadId === lead.id}>
                        <Trash2 size={13} /> Delete
                      </AppButton>
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        )}
      </SurfaceCard>

      <SurfaceCard className="p-4" style={{ minHeight: "420px" }}>
        <h3 className="m-0 text-[1.02rem] font-semibold">Conversation</h3>
        {!selectedLeadId && <p className="mt-2 text-sm text-[var(--text-soft)]">Select a lead to see conversation history.</p>}
        {selectedLeadId && (
          <div className="conversation-scroll mt-3 grid gap-2">
            {selectedLead && (
              <div className="mb-1 inline-flex items-center gap-2 text-xs text-[var(--text-soft)]">
                <Bot size={14} />
                <span className="rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-2 py-0.5">AI monitored thread</span>
                <span className="font-medium text-[var(--text)]">{getDisplayLeadName(selectedLead)}</span>
              </div>
            )}
            {messages.map((message) => (
              <div
                key={message.id}
                className="max-w-[88%] rounded-xl border border-[var(--border)] px-3 py-2 shadow-[0_8px_18px_rgba(2,8,23,0.12)]"
                style={{
                  color: message.role === "user" ? "#eff6ff" : "var(--text)",
                  justifySelf: message.role === "user" ? "end" : "start",
                  marginRight: message.role === "user" ? "0.2rem" : 0,
                  background:
                    message.role === "user"
                      ? "linear-gradient(120deg, #2563eb, #1d4ed8)"
                      : "color-mix(in srgb, var(--surface-3) 82%, var(--surface))",
                }}
              >
                <div
                  className="mb-1 flex items-center justify-between gap-2 text-[11px]"
                  style={{ color: message.role === "user" ? "#bfdbfe" : "var(--text-soft)" }}
                >
                  <span className="uppercase tracking-[0.05em]">{message.role}</span>
                  <span className="inline-flex items-center gap-1"><Clock3 size={11} />{new Date(message.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                </div>
                <div className="text-sm leading-[1.45]">{renderMessageContent(message.content)}</div>
              </div>
            ))}

            <div className="inline-flex w-fit items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1 text-xs text-[var(--text-soft)]">
              <span>AI is typing</span>
              <span className="typing-dot" />
              <span className="typing-dot" />
              <span className="typing-dot" />
            </div>
          </div>
        )}
      </SurfaceCard>
    </section>
  );
}
