"use client";

import { useCallback, useEffect, useState } from "react";
import { SurfaceCard } from "@/components/ui/surface-card";
import { AppButton } from "@/components/ui/button";

type AutomationRule = {
  id: string;
  trigger: string;
  condition: string | null;
  action: string;
  created_at: string;
};

type AutomationBuilderPanelProps = {
  agencyApiKey: string;
};

const EXAMPLE_CONDITION = JSON.stringify(
  {
    field: "lead.category",
    operator: "eq",
    value: "HOT",
  },
  null,
  2,
);

const EXAMPLE_ACTION = JSON.stringify(
  {
    type: "send_whatsapp",
    message: "New HOT lead detected. Please contact immediately.",
  },
  null,
  2,
);

export function AutomationBuilderPanel({ agencyApiKey }: Readonly<AutomationBuilderPanelProps>) {
  const [trigger, setTrigger] = useState("");
  const [condition, setCondition] = useState("");
  const [action, setAction] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [configured, setConfigured] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [rules, setRules] = useState<AutomationRule[]>([]);

  const loadRules = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/automations?agencyApiKey=${agencyApiKey}`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Unable to load automation rules");
      }
      setConfigured(data.configured !== false);
      if (data.configured === false && data.error) {
        setError(data.error);
      }
      setRules(data.automations || []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load automation rules");
    } finally {
      setLoading(false);
    }
  }, [agencyApiKey]);

  useEffect(() => {
    void loadRules();
  }, [loadRules]);

  const onCreateRule = async () => {
    if (!trigger.trim()) {
      setError("Trigger is required.");
      return;
    }

    if (condition.trim()) {
      try {
        JSON.parse(condition);
      } catch {
        setError("Condition JSON is invalid.");
        return;
      }
    }

    try {
      JSON.parse(action);
    } catch {
      setError("Action JSON is invalid.");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`/api/automations?agencyApiKey=${agencyApiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trigger,
          condition,
          action,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Unable to create automation rule");
      }

      setRules((prev) => [data.automation as AutomationRule, ...prev]);
      setSuccess("Automation rule created.");
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Unable to create automation rule");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SurfaceCard className="p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="m-0 text-[1.02rem] font-semibold">Automation Builder (JSON MVP)</h3>
        <AppButton variant="secondary" onClick={() => void loadRules()} disabled={loading}>
          {loading ? "Refreshing..." : "Refresh"}
        </AppButton>
      </div>

      <p className="mt-0 text-sm text-[var(--text-soft)]">Define trigger, condition, and action as JSON to create no-code workflows.</p>

      <div className="grid gap-2 md:grid-cols-3">
        <label className="text-xs text-[var(--text-soft)]">
          Trigger
          <input
            value={trigger}
            onChange={(event) => setTrigger(event.target.value)}
            className="input mt-1"
            placeholder="lead.created"
          />
        </label>

        <label className="text-xs text-[var(--text-soft)] md:col-span-2">
          Condition JSON
          <textarea
            value={condition}
            onChange={(event) => setCondition(event.target.value)}
            className="input mt-1 min-h-[116px] font-mono text-xs"
          />
        </label>
      </div>

      <label className="mt-2 block text-xs text-[var(--text-soft)]">
        Action JSON
        <textarea
          value={action}
          onChange={(event) => setAction(event.target.value)}
          className="input mt-1 min-h-[116px] font-mono text-xs"
        />
      </label>

      <div className="mt-2 flex flex-wrap gap-2">
        <AppButton variant="primary" onClick={() => void onCreateRule()} disabled={saving || !configured}>
          {saving ? "Saving..." : "Create Rule"}
        </AppButton>
        <AppButton
          variant="secondary"
          onClick={() => {
            setTrigger("lead.created");
            setCondition(EXAMPLE_CONDITION);
            setAction(EXAMPLE_ACTION);
            setSuccess("Example loaded. You can now create the rule.");
            setError(null);
          }}
        >
          Load Example
        </AppButton>
      </div>

      {!configured && (
        <p className="mt-2 text-sm text-amber-500">
          Automation storage is not configured yet. Run the latest Supabase schema migration to enable rule creation.
        </p>
      )}

      {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
      {success && <p className="mt-2 text-sm text-emerald-500">{success}</p>}

      <div className="mt-3 grid gap-2">
        {rules.length === 0 && !loading && (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text-soft)]">
            No automation rules yet.
          </div>
        )}

        {rules.map((rule) => (
          <article key={rule.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3">
            <div className="mb-1 flex items-center justify-between gap-2 text-xs text-[var(--text-soft)]">
              <span className="font-semibold text-[var(--text)]">{rule.trigger}</span>
              <span>{new Date(rule.created_at).toLocaleString()}</span>
            </div>
            <pre className="m-0 whitespace-pre-wrap text-xs text-[var(--text-soft)]">Condition: {rule.condition || "(none)"}</pre>
            <pre className="m-0 mt-1 whitespace-pre-wrap text-xs text-[var(--text-soft)]">Action: {rule.action}</pre>
          </article>
        ))}
      </div>
    </SurfaceCard>
  );
}
