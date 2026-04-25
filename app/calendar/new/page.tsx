import { redirect } from "next/navigation";

/** New events use `FloatingCalendarEditor`; this route keeps old links working. */
export default function CalendarNewRedirectPage() {
  redirect("/calendar");
}
