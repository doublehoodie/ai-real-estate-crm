import type { gmail_v1 } from "googleapis";

/**
 * Gmail uses URL-safe Base64; normalize before Buffer decoding.
 */
function decodeGmailBodyData(data: string): string {
  const normalized = data.replace(/-/g, "+").replace(/_/g, "/");
  const pad = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  return Buffer.from(normalized + pad, "base64").toString("utf-8");
}

/**
 * Full message body for storage/display: prefers plain text, then HTML.
 */
export function getEmailBodyFromMessage(message: any): string {
  const payload = message?.payload;
  if (!payload) return "";

  const extractBody = (part: any): string => {
    if (!part) return "";

    if (part.body?.data) {
      try {
        return decodeGmailBodyData(part.body.data);
      } catch {
        return "";
      }
    }

    const parts = part.parts || [];
    if (parts.length > 0) {
      return parts.map(extractBody).join("");
    }

    return "";
  };

  return extractBody(payload);
}

/**
 * @deprecated Use getEmailBodyFromMessage — same behavior after full MIME extraction fix.
 */
export function getPlainTextFromMessage(message: gmail_v1.Schema$Message): string {
  return getEmailBodyFromMessage(message);
}

export function classifyMailboxDirection(
  fromEmail: string | null,
  toEmail: string | null,
  mailboxEmail: string,
): "inbound" | "outbound" {
  const me = mailboxEmail.trim().toLowerCase();
  const from = fromEmail?.trim().toLowerCase() ?? "";
  if (from && from === me) return "outbound";
  return "inbound";
}

export function toBase64Url(value: string) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function getHeaderValue(
  headers: gmail_v1.Schema$MessagePartHeader[] | undefined,
  name: string,
) {
  return headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? "";
}

export function extractEmailAddress(raw: string) {
  const match = raw.match(/<([^>]+)>/);
  const value = match?.[1] ?? raw;
  return value.trim().toLowerCase();
}

export function getReceivedAt(headers: gmail_v1.Schema$MessagePartHeader[] | undefined) {
  const dateHeader = getHeaderValue(headers, "date");
  if (!dateHeader) return new Date().toISOString();
  const parsed = new Date(dateHeader);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}
