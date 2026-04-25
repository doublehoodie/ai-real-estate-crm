/**
 * GrassLeads assistant **action execution loop** (state-changing workflow).
 *
 * - **Client orchestration:** `useAssistant()` → `executeAction({ action, leadId })` in `useAssistant.ts`.
 * - **Draft follow-up:** `POST /api/ai/draft-message` (updates lead), then opens `FloatingCompose` in **reply**
 *   mode via `openFloatingCompose` (global layer in `GlobalExecutionLayers`).
 * - **Schedule meeting:** opens `FloatingCalendarEditor` with suggested slot; on save, `POST /api/calendar/events`,
 *   then `PATCH /api/leads/[id]` (`meeting_scheduled`), `refetchEvents`, and `setCalendarViewSelectedDate`.
 * - **View lead:** navigate to `/leads/[id]`.
 */

export type { AssistantExecutableAction, ExecuteActionPayload } from "@/lib/ai/assistantSurfaceTypes";
