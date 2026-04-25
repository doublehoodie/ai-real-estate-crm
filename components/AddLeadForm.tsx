"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { deriveBudgetFields } from "@/lib/budget";
import { normalizePhoneForStorage } from "@/lib/phone";
import {
  buildScoredLeadPayload,
  isMissingColumnError,
  scoreLead,
  stripScoringPersistenceFields,
} from "@/lib/scoring";
import { inputFieldClass, primaryButton } from "@/lib/ui";

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
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) {
        console.error("No user session found");
        setError("You must be logged in to add a lead.");
        return;
      }

      console.log("USER ID:", user.id);

      const newId = crypto.randomUUID();
      const { budget, budget_value } = deriveBudgetFields(form.budget || null);
      const baseRow = buildScoredLeadPayload({
        name: form.name || null,
        email: form.email || null,
        phone: normalizePhoneForStorage(form.phone),
        budget,
        timeline: form.timeline || null,
        status: form.status || null,
        notes: form.notes || null,
        is_favorite: form.is_favorite,
      });

      const { error: insertError } = await supabase.from("leads").insert([
        { ...baseRow, id: newId, budget_value, user_id: user.id },
      ]);

      if (insertError) {
        const message = insertError.message ?? "";
        const scoringColumnMissing =
          isMissingColumnError(message, "ai_score_breakdown") ||
          isMissingColumnError(message, "ai_score") ||
          isMissingColumnError(message, "updated_at");
        const budgetValueColumnMissing = isMissingColumnError(message, "budget_value");

        if (!scoringColumnMissing && !budgetValueColumnMissing) {
          console.error(insertError);
          setError(insertError.message || "Failed to save lead. Please try again.");
          return;
        }

        let fallbackRow: Record<string, unknown>;
        if (scoringColumnMissing) {
          fallbackRow = { ...stripScoringPersistenceFields(baseRow), id: newId, budget_value, user_id: user.id };
        } else {
          fallbackRow = { ...baseRow, id: newId, budget_value, user_id: user.id };
        }
        if (budgetValueColumnMissing) {
          const { budget_value: _drop, ...rest } = fallbackRow;
          fallbackRow = rest;
        }

        const { error: fallbackError } = await supabase.from("leads").insert([fallbackRow]);

        if (fallbackError) {
          console.error(fallbackError);
          setError(fallbackError.message || "Failed to save lead. Please try again.");
          return;
        }
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
            body: JSON.stringify({ lead_id: newId, email_body: aiInput }),
          });
        } catch (e) {
          console.error("[AddLeadForm] AI scoring trigger:", e);
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
      className="mb-6 grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] items-end gap-x-4 gap-y-3 rounded-2xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6 shadow-lg backdrop-blur transition-all duration-200 ease-out hover:scale-[1.01]"
    >
      <div className="col-span-full mb-1">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="m-0 text-lg font-semibold tracking-tight text-slate-900 dark:text-white">Add Lead</h2>
            <p className="mt-1 text-[13px] text-slate-700 dark:text-slate-300">
              Manually create a new lead. Scoring is calculated automatically from structured fields and notes.
            </p>
          </div>
          <div className="min-w-[180px] rounded-xl border border-slate-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3.5 py-3">
            <div className="mb-1 text-xs text-slate-700 dark:text-slate-300">Score preview</div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white">{scorePreview.score}</div>
            <div className="text-xs capitalize text-slate-700 dark:text-slate-300">{scorePreview.confidence} confidence</div>
          </div>
        </div>
      </div>

      <Field label="Name">
        <input
          type="text"
          value={form.name}
          onChange={(e) => handleChange("name", e.target.value)}
          placeholder="Jane Doe"
          className={inputFieldClass}
        />
      </Field>

      <Field label="Email">
        <input
          type="email"
          value={form.email}
          onChange={(e) => handleChange("email", e.target.value)}
          placeholder="jane@example.com"
          className={inputFieldClass}
        />
      </Field>

      <Field label="Phone">
        <input
          type="tel"
          value={form.phone}
          onChange={(e) => handleChange("phone", e.target.value)}
          placeholder="(555) 123-4567"
          className={inputFieldClass}
        />
      </Field>

      <Field label="Budget">
        <input
          type="text"
          value={form.budget}
          onChange={(e) => handleChange("budget", e.target.value)}
          placeholder="$800,000"
          className={inputFieldClass}
        />
      </Field>

      <Field label="Timeline">
        <input
          type="text"
          value={form.timeline}
          onChange={(e) => handleChange("timeline", e.target.value)}
          placeholder="3–6 months"
          className={inputFieldClass}
        />
      </Field>

      <Field label="Notes">
        <textarea
          value={form.notes}
          onChange={(e) => handleChange("notes", e.target.value)}
          placeholder="Context, preferences, or any notes about this lead."
          className={`${inputFieldClass} min-h-[72px] resize-y`}
        />
      </Field>

      <Field label="Status">
        <select
          value={form.status}
          onChange={(e) => handleChange("status", e.target.value)}
          className={`${inputFieldClass} pr-8`}
        >
          <option value="New">New</option>
          <option value="Hot">Hot</option>
          <option value="Warm">Warm</option>
          <option value="Cold">Cold</option>
          <option value="Nurture">Nurture</option>
          <option value="Closed">Closed</option>
        </select>
      </Field>

      <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
        <input
          type="checkbox"
          checked={form.is_favorite}
          onChange={(e) => handleChange("is_favorite", e.target.checked)}
          className="size-4 rounded border-slate-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-emerald-500 focus:ring-2 focus:ring-green-500"
        />
        <span>Mark as favorite</span>
      </label>

      <div className="flex flex-col gap-2">
        <button
          type="submit"
          disabled={submitting}
          className={`self-start whitespace-nowrap text-sm ${primaryButton}`}
        >
          {submitting ? "Saving..." : "Add Lead"}
        </button>
        {error && <span className="text-xs text-red-600 dark:text-red-300">{error}</span>}
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
    <label className="flex flex-col gap-1 text-[13px] text-slate-700 dark:text-slate-300">
      <span>{label}</span>
      {children}
    </label>
  );
}

