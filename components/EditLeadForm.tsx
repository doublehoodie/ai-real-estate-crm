"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { deriveBudgetFields } from "@/lib/budget";
import { coercePhoneFromApi, normalizePhoneForStorage } from "@/lib/phone";
import {
  buildScoredLeadPayload,
  isMissingColumnError,
  scoreLead,
  stripScoringPersistenceFields,
} from "@/lib/scoring";
import type { Lead } from "@/types/lead";

type EditLeadFormProps = {
  lead: Lead;
};

type FormState = {
  name: string;
  email: string;
  phone: string;
  budget: string;
  timeline: string;
  status: string;
  notes: string;
};

export function EditLeadForm({ lead }: EditLeadFormProps) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>({
    name: lead.name ?? "",
    email: lead.email ?? "",
    phone: coercePhoneFromApi(lead.phone) ?? "",
    budget: lead.budget ?? "",
    timeline: lead.timeline ?? "",
    status: lead.status ?? "New",
    notes: lead.notes ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scorePreview = useMemo(
    () =>
      scoreLead({
        ...lead,
        ...form,
      }),
    [form, lead],
  );

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const { budget, budget_value } = deriveBudgetFields(form.budget || null);
      const payload = buildScoredLeadPayload({
        name: form.name || null,
        email: form.email || null,
        phone: normalizePhoneForStorage(form.phone),
        budget,
        timeline: form.timeline || null,
        status: form.status || null,
        notes: form.notes || null,
      });

      const fullUpdate = { ...payload, budget_value };

      const { error: updateError } = await supabase
        .from("leads")
        .update(fullUpdate)
        .eq("id", lead.id);

      if (updateError) {
        const message = updateError.message ?? "";
        const scoringColumnMissing =
          isMissingColumnError(message, "score_breakdown") ||
          isMissingColumnError(message, "score_explanation") ||
          isMissingColumnError(message, "updated_at");
        const budgetValueColumnMissing = isMissingColumnError(message, "budget_value");

        if (!scoringColumnMissing && !budgetValueColumnMissing) {
          setError(updateError.message || "Failed to update lead.");
          return;
        }

        let fallbackPayload: Record<string, unknown> = scoringColumnMissing
          ? { ...stripScoringPersistenceFields(payload), budget_value }
          : { ...fullUpdate };

        if (budgetValueColumnMissing) {
          const { budget_value: _drop, ...rest } = fallbackPayload;
          fallbackPayload = rest;
        }

        const { error: fallbackError } = await supabase
          .from("leads")
          .update(fallbackPayload)
          .eq("id", lead.id);

        if (fallbackError) {
          setError(fallbackError.message || "Failed to update lead.");
          return;
        }
      }

      try {
        const mirror = await fetch("/api/inbox/lead-profile-note", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ leadId: lead.id, note: form.notes }),
        });
        if (!mirror.ok) {
          console.error("[EditLeadForm] lead-profile-note mirror:", await mirror.text());
        }
      } catch (e) {
        console.error("[EditLeadForm] lead-profile-note mirror:", e);
      }

      router.refresh();
    } catch (err) {
      console.error(err);
      setError("Something went wrong while updating the lead.");
    } finally {
      setSaving(false);
    }
  }

  function handleChange<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        background: "white",
        borderRadius: "12px",
        padding: "20px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
        display: "grid",
        gap: "14px",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: "16px", alignItems: "flex-start", flexWrap: "wrap" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: "18px", color: "#111827" }}>Edit lead</h2>
          <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#6b7280" }}>
            Updating any qualification field automatically recalculates the lead score.
          </p>
        </div>

        <div
          style={{
            borderRadius: "12px",
            padding: "12px 14px",
            background: "#f8fafc",
            border: "1px solid #e5e7eb",
            minWidth: "180px",
          }}
        >
          <div style={{ fontSize: "12px", color: "#6b7280", marginBottom: "4px" }}>Score preview</div>
          <div style={{ fontSize: "24px", fontWeight: 700, color: "#111827" }}>{scorePreview.score}</div>
          <div style={{ fontSize: "12px", color: "#6b7280", textTransform: "capitalize" }}>
            {scorePreview.confidence} confidence
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "12px 16px" }}>
        <Field label="Name">
          <input value={form.name} onChange={(e) => handleChange("name", e.target.value)} style={inputStyle} />
        </Field>
        <Field label="Email">
          <input type="email" value={form.email} onChange={(e) => handleChange("email", e.target.value)} style={inputStyle} />
        </Field>
        <Field label="Phone">
          <input value={form.phone} onChange={(e) => handleChange("phone", e.target.value)} style={inputStyle} />
        </Field>
        <Field label="Budget">
          <input value={form.budget} onChange={(e) => handleChange("budget", e.target.value)} style={inputStyle} />
        </Field>
        <Field label="Timeline">
          <input value={form.timeline} onChange={(e) => handleChange("timeline", e.target.value)} style={inputStyle} />
        </Field>
        <Field label="Status">
          <select value={form.status} onChange={(e) => handleChange("status", e.target.value)} style={inputStyle}>
            <option value="New">New</option>
            <option value="Hot">Hot</option>
            <option value="Warm">Warm</option>
            <option value="Cold">Cold</option>
            <option value="Nurture">Nurture</option>
            <option value="Closed">Closed</option>
          </select>
        </Field>
        <Field label="Notes">
          <textarea
            value={form.notes}
            onChange={(e) => handleChange("notes", e.target.value)}
            style={{ ...inputStyle, minHeight: "120px", gridColumn: "1 / -1" }}
          />
        </Field>
      </div>

      <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
        <button
          type="submit"
          disabled={saving}
          style={{
            border: "none",
            borderRadius: "999px",
            background: "#111827",
            color: "white",
            padding: "10px 16px",
            fontWeight: 600,
            cursor: saving ? "default" : "pointer",
          }}
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>
        {error ? <span style={{ color: "#b42318", fontSize: "13px" }}>{error}</span> : null}
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px", color: "#374151" }}>
      <span>{label}</span>
      {children}
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: "10px",
  border: "1px solid #e5e7eb",
  fontSize: "14px",
  background: "white",
};
