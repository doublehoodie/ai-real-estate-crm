import { Sidebar } from "@/components/Sidebar";
import { Calendar } from "@/components/Calendar";

export default function AppointmentsPage() {
  return (
    <main
      style={{
        display: "flex",
        minHeight: "100vh",
        fontFamily: "Arial, sans-serif",
        background: "#f7f8fa",
      }}
    >
      <Sidebar active="appointments" />

      <section style={{ flex: 1, padding: "32px" }}>
        <h1 style={{ marginBottom: "8px", color: "#111" }}>Appointments</h1>
        <p style={{ color: "#444", marginBottom: "24px" }}>
          Central calendar for showings, buyer consults, and follow-ups.
        </p>

        <Calendar />
      </section>
    </main>
  );
}

