"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { isUuid } from "@/lib/ids";
import { clearSeedInboxCompose, readSeedInboxCompose, type SeedInboxComposePayload } from "@/lib/navigation/seedSessionBridge";
import { primaryButton, secondaryButton } from "@/lib/ui";

function consumeInboxSeed(leadId: string): SeedInboxComposePayload | null {
  const raw = readSeedInboxCompose();
  if (!raw || raw.leadId !== leadId) return null;
  clearSeedInboxCompose();
  return raw;
}

export function InboxComposeClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const leadIdParam = searchParams.get("leadId")?.trim() ?? "";

  const validLeadId = useMemo(() => (isUuid(leadIdParam) ? leadIdParam : ""), [leadIdParam]);

  const [seed] = useState<SeedInboxComposePayload | null>(() =>
    isUuid(leadIdParam) ? consumeInboxSeed(leadIdParam) : null,
  );

  const [to, setTo] = useState(seed?.to ?? "");
  const [subject, setSubject] = useState(seed?.subject ?? "Following up");
  const [body, setBody] = useState(seed?.body ?? "");
  const [contextNote, setContextNote] = useState(seed?.contextNote ?? "");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!validLeadId || seed) return;
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/leads", { credentials: "include" });
      const data = (await res.json().catch(() => ({}))) as {
        leads?: Array<{ id: string; email?: string | null; ai_summary?: string | null }>;
      };
      if (cancelled) return;
      const lead = (data.leads ?? []).find((l) => l.id === validLeadId);
      if (lead) {
        setTo(lead.email?.trim() ?? "");
        if (lead.ai_summary?.trim()) {
          setContextNote(`AI summary: ${lead.ai_summary.trim()}`);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [validLeadId, seed]);

  async function handleSend() {
    if (!to.trim() || !subject.trim() || !body.trim()) {
      setError("To, subject, and message are required.");
      return;
    }
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/email/send", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: to.trim(), subject: subject.trim(), body: body.trim() }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error || "Send failed");
        return;
      }
      router.push("/inbox");
    } catch {
      setError("Send failed");
    } finally {
      setSending(false);
    }
  }

  if (!validLeadId) {
    return <p className="text-sm text-zinc-400">Missing or invalid leadId in the URL.</p>;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <p className="text-sm text-emerald-400/90">Prefilled from Seed — nothing sends until you confirm.</p>

      {contextNote ? (
        <div className="rounded-xl border border-white/10 bg-zinc-900/60 p-4">
          <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">Lead context</div>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-zinc-300">{contextNote}</p>
        </div>
      ) : null}

      <div className="space-y-4 rounded-xl border border-white/10 bg-zinc-900/40 p-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-400">To</label>
          <input
            className="w-full rounded-lg border border-white/10 bg-zinc-950/60 px-3 py-2 text-sm text-zinc-100"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="lead@email.com"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-400">Subject</label>
          <input
            className="w-full rounded-lg border border-white/10 bg-zinc-950/60 px-3 py-2 text-sm text-zinc-100"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-400">Message</label>
          <textarea
            className="min-h-[200px] w-full resize-y rounded-lg border border-white/10 bg-zinc-950/60 px-3 py-2 text-sm leading-relaxed text-zinc-100"
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
        </div>
        {error ? (
          <p className="text-sm text-red-400" role="alert">
            {error}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <button type="button" className={primaryButton} disabled={sending} onClick={() => void handleSend()}>
            {sending ? "Sending…" : "Send"}
          </button>
          <button type="button" className={secondaryButton} disabled={sending} onClick={() => router.push("/inbox")}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
