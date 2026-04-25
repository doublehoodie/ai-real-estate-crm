import { AppLayout } from "@/components/layout/AppLayout";
import { InboxPanel } from "@/components/InboxPanel";

export default function InboxPage() {
  return (
    <AppLayout
      active="inbox"
      title="Inbox"
      description="This inbox aggregates emails, texts, and calls for your leads."
    >
      <InboxPanel />
    </AppLayout>
  );
}

