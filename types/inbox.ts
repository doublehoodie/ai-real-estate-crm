import type { Lead } from "@/types/lead";

export type EmailDirection = "inbound" | "outbound";

export type InboxEmailRow = {
  message_id: string | null;
  thread_id: string | null;
  from_email: string | null;
  to_email: string | null;
  subject: string;
  snippet: string;
  received_at: string;
  lead_id: string | null;
  provider: string;
  direction: EmailDirection | null;
  lead?: Pick<Lead, "id" | "name" | "email"> | null;
};

export type InboxThreadMeta = {
  thread_id: string;
  is_favorite: boolean;
  needs_action: boolean;
};

export type InboxThreadNote = {
  id: string;
  thread_id: string | null;
  lead_id?: string | null;
  note: string;
  created_at: string;
};

export type InboxThreadSummary = {
  thread_id: string;
  subject: string;
  latest_snippet: string;
  latest_at: string;
  message_count: number;
  lead: { id: string; name: string | null; email: string | null } | null;
  needs_attention: boolean;
  is_favorite: boolean;
  needs_action: boolean;
  notes: InboxThreadNote[];
  messages: InboxEmailRow[];
};

export type ThreadMessageDetail = {
  message_id: string;
  thread_id: string | null;
  from_email: string | null;
  to_email: string | null;
  subject: string;
  received_at: string;
  snippet: string;
  body_text: string;
  direction: EmailDirection | null;
};
