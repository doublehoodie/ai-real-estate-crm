import type { gmail_v1 } from "googleapis";

/**
 * Gmail uses URL-safe Base64; normalize before Buffer decoding.
 */
function decodeGmailBodyData(data: string): string {
  const normalized = data.replace(/-/g, "+").replace(/_/g, "/");
  const pad = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  return Buffer.from(normalized + pad, "base64").toString("utf-8");
}

type MimeAccumulator = { plain: string[]; html: string[] };

/**
 * Recursively walk Gmail message parts; collect all text/plain and text/html bodies.
 * Inline parts use body.data; attachmentId-only parts are skipped (would require attachments.get).
 */
function collectBodiesFromPart(part: gmail_v1.Schema$MessagePart | undefined, acc: MimeAccumulator): void {
  if (!part) return;

  const mime = part.mimeType?.toLowerCase() ?? "";

  if (part.body?.data) {
    if (mime.startsWith("text/plain")) {
      try {
        acc.plain.push(decodeGmailBodyData(part.body.data));
      } catch {
        /* invalid base64 */
      }
    } else if (mime.startsWith("text/html")) {
      try {
        acc.html.push(decodeGmailBodyData(part.body.data));
      } catch {
        /* invalid base64 */
      }
    }
  }

  if (part.parts?.length) {
    for (const child of part.parts) {
      collectBodiesFromPart(child, acc);
    }
  }
}

/**
 * Full message body for storage/display: prefers plain text, then HTML.
 */
export function getEmailBodyFromMessage(message: gmail_v1.Schema$Message): string {
  const acc: MimeAccumulator = { plain: [], html: [] };
  collectBodiesFromPart(message.payload, acc);

  const plain = acc.plain.join("\n\n").trim();
  if (plain) return plain;

  const html = acc.html.join("\n\n").trim();
  if (html) return html;

  return "(No body)";
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
