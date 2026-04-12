"use client";

import { sanitizeHtml } from "@/lib/sanitizeHtml";

type EmailMessageBodyProps = {
  bodyText: string;
};

function PlainBody({ children }: { children: string }) {
  return <pre className="m-0 whitespace-pre-wrap text-sm">{children}</pre>;
}

/**
 * Renders email body: anything with "<" is sanitized as HTML by default; no "<" → plain text.
 * Falls back to &lt;pre&gt; if sanitization yields nothing or throws.
 */
export function EmailMessageBody({ bodyText }: EmailMessageBodyProps) {
  const raw = bodyText ?? "";
  if (!raw.trim()) {
    return (
      <p className="m-0 text-sm text-slate-400" role="status">
        (No body)
      </p>
    );
  }

  // Light heuristic: no angle brackets → plain text only (skip HTML pipeline)
  if (!raw.includes("<")) {
    return <PlainBody>{raw}</PlainBody>;
  }

  try {
    const sanitized = sanitizeHtml(raw);
    if (!sanitized.trim()) {
      return <PlainBody>{raw}</PlainBody>;
    }
    return (
      <div
        className="prose max-w-none text-sm"
        dangerouslySetInnerHTML={{ __html: sanitized }}
      />
    );
  } catch {
    return <PlainBody>{raw}</PlainBody>;
  }
}
