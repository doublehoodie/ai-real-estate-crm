import { Sidebar } from "@/components/Sidebar";
import { Calendar } from "@/components/Calendar";

export default function AppointmentsPage() {
  return (
    <main className="flex min-h-screen bg-[#f3f4f6]">
      <Sidebar active="appointments" />

      <section style={{ flex: 1, padding: "32px" }}>
        <h1 className="mb-2 text-gray-900">Appointments</h1>
        <p className="mb-6 text-gray-500">
          Central calendar for showings, buyer consults, and follow-ups.
        </p>

        <Calendar />
      </section>
    </main>
  );
}

