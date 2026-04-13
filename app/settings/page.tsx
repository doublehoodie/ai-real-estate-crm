import { Sidebar } from "@/components/Sidebar";

export default function SettingsPage() {
  return (
    <main className="flex min-h-screen bg-[#f3f4f6]">
      <Sidebar active="settings" />

      <section style={{ flex: 1, padding: "32px" }}>
        <h1 className="mb-2 text-gray-900">Settings</h1>
        <p className="text-gray-500">
          Account and workspace settings will live here.
        </p>
      </section>
    </main>
  );
}

