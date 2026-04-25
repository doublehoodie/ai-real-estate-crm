/**
 * SessionStorage payloads when Seed redirects into Inbox / Calendar flows.
 * Cleared by destination pages after a successful read.
 */

export const SEED_INBOX_COMPOSE_KEY = "grassleads:seed:inboxCompose";
export const SEED_CALENDAR_NEW_KEY = "grassleads:seed:calendarNew";

export type SeedInboxComposePayload = {
  leadId: string;
  body: string;
  to: string;
  leadName: string;
  subject: string;
  contextNote: string;
};

export type SeedCalendarNewPayload = {
  leadId: string;
  leadName: string;
  title: string;
  description: string;
  suggestedStartIso: string;
  suggestedEndIso: string;
};

export function writeSeedInboxCompose(payload: SeedInboxComposePayload): void {
  try {
    sessionStorage.setItem(SEED_INBOX_COMPOSE_KEY, JSON.stringify(payload));
  } catch {
    /* quota / private mode */
  }
}

export function readSeedInboxCompose(): SeedInboxComposePayload | null {
  try {
    const raw = sessionStorage.getItem(SEED_INBOX_COMPOSE_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw) as SeedInboxComposePayload;
    if (!o || typeof o.leadId !== "string" || typeof o.body !== "string") return null;
    return o;
  } catch {
    return null;
  }
}

export function clearSeedInboxCompose(): void {
  try {
    sessionStorage.removeItem(SEED_INBOX_COMPOSE_KEY);
  } catch {
    /* ignore */
  }
}

export function writeSeedCalendarNew(payload: SeedCalendarNewPayload): void {
  try {
    sessionStorage.setItem(SEED_CALENDAR_NEW_KEY, JSON.stringify(payload));
  } catch {
    /* ignore */
  }
}

export function readSeedCalendarNew(): SeedCalendarNewPayload | null {
  try {
    const raw = sessionStorage.getItem(SEED_CALENDAR_NEW_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw) as SeedCalendarNewPayload;
    if (!o || typeof o.leadId !== "string" || typeof o.suggestedStartIso !== "string") return null;
    return o;
  } catch {
    return null;
  }
}

export function clearSeedCalendarNew(): void {
  try {
    sessionStorage.removeItem(SEED_CALENDAR_NEW_KEY);
  } catch {
    /* ignore */
  }
}
