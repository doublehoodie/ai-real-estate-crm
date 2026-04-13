import { Sidebar } from "@/components/Sidebar";
import { InboxPanel } from "@/components/InboxPanel";

export default function InboxPage() {
  return (
    <main className="flex min-h-screen bg-[#f3f4f6]">
      <Sidebar active="inbox" />

      <section style={{ flex: 1, padding: "32px" }}>
        <h1 className="mb-2 text-gray-900">Inbox</h1>
        <p className="mb-6 text-gray-500">
          This inbox will aggregate emails, texts, and calls for your leads.
        </p>

        <InboxPanel />
      </section>
    </main>
  );
}

