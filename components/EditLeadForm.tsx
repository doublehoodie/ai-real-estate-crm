"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { deriveBudgetFields } from "@/lib/budget";
import { coercePhoneFromApi, normalizePhoneForStorage } from "@/lib/phone";
import {
  buildScoredLeadPayload,
  computeAiScoreFromBreakdown,
  getScoreBand,
  isMissingColumnError,
  scoreLead,
  stripScoringPersistenceFields,
} from "@/lib/scoring";
import type { Lead } from "@/types/lead";
import { inputFieldClass, primaryButton } from "@/lib/ui";

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

  const aiScorePreview = useMemo(() => {
    const computedScore = computeAiScoreFromBreakdown(lead.ai_score_breakdown);
    console.log("[SCORE DEBUG]", {
      ai_score: lead.ai_score ?? null,
      breakdown: lead.ai_score_breakdown ?? null,
      computedScore,
    });

    if (computedScore !== null) {
      return {
        aiScore: computedScore,
        confidence: getScoreBand(computedScore).label.toLowerCase(),
      };
    }

    if (lead.ai_processed === true) {
      return {
        aiScore: 0,
        confidence: getScoreBand(0).label.toLowerCase(),
      };
    }

    const fallback = scoreLead({
      ...lead,
      ...form,
    });

    return {
      aiScore: fallback.score,
      confidence: fallback.confidence,
    };
  }, [form, lead]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !user?.id) {
        setError("You must be logged in to edit leads.");
        return;
      }

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
        .eq("id", lead.id)
        .eq("user_id", user.id);

      if (updateError) {
        const message = updateError.message ?? "";
        const scoringColumnMissing =
          isMissingColumnError(message, "ai_score_breakdown") ||
          isMissingColumnError(message, "ai_score") ||
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
          .eq("id", lead.id)
          .eq("user_id", user.id);

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

      const aiInput = [form.notes, form.timeline, form.budget, form.status]
        .filter((v): v is string => typeof v === "string")
        .join("\n")
        .trim();
      if (aiInput.length > 20) {
        try {
          await fetch("/api/ai/process-lead", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ lead_id: lead.id, email_body: aiInput }),
          });
        } catch (e) {
          console.error("[EditLeadForm] AI scoring trigger:", e);
        }
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
      className="grid gap-3.5 rounded-2xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6 shadow-lg backdrop-blur-md"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="m-0 text-lg font-semibold tracking-tight text-slate-900 dark:text-white">Edit lead</h2>
          <p className="mt-1 text-[13px] text-slate-700 dark:text-slate-300">
            Updating any qualification field automatically recalculates the lead score.
          </p>
        </div>

        <div className="min-w-[180px] rounded-xl border border-slate-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3.5 py-3">
          <div className="mb-1 text-xs text-slate-700 dark:text-slate-300">Score preview</div>
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">{aiScorePreview.aiScore}</div>
          <div className="text-xs capitalize text-slate-700 dark:text-slate-300">{aiScorePreview.confidence} confidence</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "12px 16px" }}>
        <Field label="Name">
          <input
            value={form.name}
            onChange={(e) => handleChange("name", e.target.value)}
            className={`${inputFieldClass} bg-white dark:bg-neutral-900 border-slate-300 dark:border-neutral-700 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-green-500`}
          />
        </Field>
        <Field label="Email">
          <input
            type="email"
            value={form.email}
            onChange={(e) => handleChange("email", e.target.value)}
            className={`${inputFieldClass} bg-white dark:bg-neutral-900 border-slate-300 dark:border-neutral-700 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-green-500`}
          />
        </Field>
        <Field label="Phone">
          <input
            value={form.phone}
            onChange={(e) => handleChange("phone", e.target.value)}
            className={`${inputFieldClass} bg-white dark:bg-neutral-900 border-slate-300 dark:border-neutral-700 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-green-500`}
          />
        </Field>
        <Field label="Budget">
          <input
            value={form.budget}
            onChange={(e) => handleChange("budget", e.target.value)}
            className={`${inputFieldClass} bg-white dark:bg-neutral-900 border-slate-300 dark:border-neutral-700 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-green-500`}
          />
        </Field>
        <Field label="Timeline">
          <input
            value={form.timeline}
            onChange={(e) => handleChange("timeline", e.target.value)}
            className={`${inputFieldClass} bg-white dark:bg-neutral-900 border-slate-300 dark:border-neutral-700 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-green-500`}
          />
        </Field>
        <Field label="Status">
          <select
            value={form.status}
            onChange={(e) => handleChange("status", e.target.value)}
            className={`${inputFieldClass} pr-8 bg-white dark:bg-neutral-900 border-slate-300 dark:border-neutral-700 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-green-500`}
          >
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
            className={`${inputFieldClass} min-h-[120px] resize-y [grid-column:1/-1] bg-white dark:bg-neutral-900 border-slate-300 dark:border-neutral-700 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-green-500`}
          />
        </Field>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className={`cursor-pointer text-sm ${primaryButton}`}
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>
        {error ? <span className="text-sm text-red-600 dark:text-red-300">{error}</span> : null}
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-[13px] text-slate-700 dark:text-slate-300">
      <span>{label}</span>
      {children}
    </label>
  );
}
