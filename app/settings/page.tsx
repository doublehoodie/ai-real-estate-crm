import { Sidebar } from "@/components/Sidebar";

export default function SettingsPage() {
  return (
    <main
      style={{
        display: "flex",
        minHeight: "100vh",
        fontFamily: "Arial, sans-serif",
        background: "#f7f8fa",
      }}
    >
      <Sidebar active="settings" />

      <section style={{ flex: 1, padding: "32px" }}>
        <h1 style={{ marginBottom: "8px", color: "#111" }}>Settings</h1>
        <p style={{ color: "#444" }}>
          Account and workspace settings will live here.
        </p>
      </section>
    </main>
  );
}

