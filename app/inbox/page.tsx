import { Sidebar } from "@/components/Sidebar";

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

        <div
          style={{
            background: "white",
            borderRadius: "12px",
            padding: "20px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
          }}
        >
          <p style={{ margin: 0, color: "#6b7280", fontSize: "14px" }}>
            Messaging integration is not connected yet. In a later phase, this
            view will show conversations and AI summaries for each lead.
          </p>
        </div>
      </section>
    </main>
  );
}

