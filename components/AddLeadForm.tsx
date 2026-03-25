"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  buildScoredLeadPayload,
  isMissingColumnError,
  scoreLead,
  stripScoringPersistenceFields,
} from "@/lib/scoring";

type FormState = {
  name: string;
  email: string;
  phone: string;
  budget: string;
  timeline: string;
  status: string;
  notes: string;
  is_favorite: boolean;
};

const initialState: FormState = {
  name: "",
  email: "",
  phone: "",
  budget: "",
  timeline: "",
  status: "New",
  notes: "",
  is_favorite: false,
};

export function AddLeadForm() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(initialState);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scorePreview = useMemo(() => scoreLead(form), [form]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const trimmedName = form.name.trim();
    const hasEmail = form.email.trim().length > 0;
    const hasPhone = form.phone.trim().length > 0;

    if (!trimmedName || (!hasEmail && !hasPhone)) {
      setError("Name and at least one contact method (email or phone) are required.");
      return;
    }

    setSubmitting(true);

    try {
      const baseRow = buildScoredLeadPayload({
        name: form.name || null,
        email: form.email || null,
        phone: form.phone || null,
        budget: form.budget || null,
        timeline: form.timeline || null,
        status: form.status || null,
        notes: form.notes || null,
        is_favorite: form.is_favorite,
      });

      const { error: insertError } = await supabase.from("leads").insert([
        baseRow,
      ]);

      if (insertError) {
        const message = insertError.message ?? "";
        const scoringColumnMissing =
          isMissingColumnError(message, "score_breakdown") ||
          isMissingColumnError(message, "score_explanation") ||
          isMissingColumnError(message, "updated_at");

        if (!scoringColumnMissing) {
          console.error(insertError);
          setError(insertError.message || "Failed to save lead. Please try again.");
          return;
        }

        const fallbackRow = stripScoringPersistenceFields(baseRow);
        const { error: fallbackError } = await supabase.from("leads").insert([
          fallbackRow,
        ]);

        if (fallbackError) {
          console.error(fallbackError);
          setError(fallbackError.message || "Failed to save lead. Please try again.");
          return;
        }
      }

      setForm(initialState);
      router.refresh();
    } catch (err) {
      console.error(err);
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
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
        marginBottom: "24px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        gap: "12px 16px",
        alignItems: "end",
      }}
    >
      <div style={{ gridColumn: "1 / -1", marginBottom: "4px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "16px", alignItems: "flex-start", flexWrap: "wrap" }}>
          <div>
            <h2 style={{ margin: 0, color: "#111" }}>Add Lead</h2>
            <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#6b7280" }}>
              Manually create a new lead. Scoring is calculated automatically from structured fields and notes.
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
      </div>

      <Field label="Name">
        <input
          type="text"
          value={form.name}
          onChange={(e) => handleChange("name", e.target.value)}
          placeholder="Jane Doe"
          style={inputStyle}
        />
      </Field>

      <Field label="Email">
        <input
          type="email"
          value={form.email}
          onChange={(e) => handleChange("email", e.target.value)}
          placeholder="jane@example.com"
          style={inputStyle}
        />
      </Field>

      <Field label="Phone">
        <input
          type="tel"
          value={form.phone}
          onChange={(e) => handleChange("phone", e.target.value)}
          placeholder="(555) 123-4567"
          style={inputStyle}
        />
      </Field>

      <Field label="Budget">
        <input
          type="text"
          value={form.budget}
          onChange={(e) => handleChange("budget", e.target.value)}
          placeholder="$800,000"
          style={inputStyle}
        />
      </Field>

      <Field label="Timeline">
        <input
          type="text"
          value={form.timeline}
          onChange={(e) => handleChange("timeline", e.target.value)}
          placeholder="3–6 months"
          style={inputStyle}
        />
      </Field>

      <Field label="Notes">
        <textarea
          value={form.notes}
          onChange={(e) => handleChange("notes", e.target.value)}
          placeholder="Context, preferences, or any notes about this lead."
          style={{
            ...inputStyle,
            minHeight: "72px",
            resize: "vertical",
          }}
        />
      </Field>

      <Field label="Status">
        <select
          value={form.status}
          onChange={(e) => handleChange("status", e.target.value)}
          style={{
            ...inputStyle,
            paddingRight: "32px",
          }}
        >
          <option value="New">New</option>
          <option value="Hot">Hot</option>
          <option value="Warm">Warm</option>
          <option value="Cold">Cold</option>
          <option value="Nurture">Nurture</option>
          <option value="Closed">Closed</option>
        </select>
      </Field>

      <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={form.is_favorite}
          onChange={(e) => handleChange("is_favorite", e.target.checked)}
          className="size-4 rounded border-slate-300 text-teal-700 focus:ring-2 focus:ring-teal-500/40"
        />
        <span>Mark as favorite</span>
      </label>

      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <button
          type="submit"
          disabled={submitting}
          style={{
            padding: "10px 16px",
            borderRadius: "999px",
            border: "none",
            background: submitting ? "#9ca3af" : "#111827",
            color: "white",
            fontSize: "14px",
            fontWeight: 600,
            cursor: submitting ? "default" : "pointer",
            alignSelf: "flex-start",
            whiteSpace: "nowrap",
          }}
        >
          {submitting ? "Saving..." : "Add Lead"}
        </button>
        {error && (
          <span style={{ fontSize: "12px", color: "#b91c1c" }}>
            {error}
          </span>
        )}
      </div>
    </form>
  );
}

type FieldProps = {
  label: string;
  children: React.ReactNode;
};

function Field({ label, children }: FieldProps) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "13px", color: "#374151" }}>
      <span>{label}</span>
      {children}
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: "8px",
  border: "1px solid #e5e7eb",
  fontSize: "14px",
};
