import { Sidebar } from "@/components/Sidebar";
import { InboxPanel } from "@/components/InboxPanel";

export default function InboxPage() {
  return (
    <main
      style={{
        display: "flex",
        minHeight: "100vh",
        fontFamily: "Arial, sans-serif",
        background: "#f7f8fa",
      }}
    >
      <Sidebar active="inbox" />

      <section style={{ flex: 1, padding: "32px" }}>
        <h1 style={{ marginBottom: "8px", color: "#111" }}>Inbox</h1>
        <p style={{ color: "#444", marginBottom: "24px" }}>
          This inbox will aggregate emails, texts, and calls for your leads.
        </p>

        <InboxPanel />
      </section>
    </main>
  );
}

