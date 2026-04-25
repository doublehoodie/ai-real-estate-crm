import { redirect } from "next/navigation";

/** Compose is in-context via `FloatingCompose`; this route keeps old links working. */
export default function InboxComposeRedirectPage() {
  redirect("/inbox");
}
