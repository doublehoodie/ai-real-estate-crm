import { Sidebar } from "@/components/Sidebar";
import { SCORING_RUBRIC, SCORE_INTERPRETATION } from "@/lib/scoring";

export default function HelpPage() {
  return (
    <main className="flex min-h-screen bg-[#f3f4f6]">
      <Sidebar active="help" />

      <section style={{ flex: 1, padding: "32px" }}>
        <h1 className="mb-2 text-gray-900">Help</h1>
        <p className="mb-6 max-w-[760px] text-gray-500">
          This CRM uses an explainable lead scoring model so agents can quickly prioritize the leads most likely to convert.
        </p>

        <div style={{ display: "grid", gap: "20px" }}>
          <HelpCard title="How Lead Scoring Works">
            <p style={paragraphStyle}>
              Every lead receives a score from 0 to 100 across five categories. The model blends financial readiness,
              urgency, buying intent, fit quality, and data confidence into one deterministic score.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px" }}>
              {SCORING_RUBRIC.map((category) => (
                <div key={category.key} style={miniCardStyle}>
                  <div style={{ fontSize: "13px", color: "#6b7280", marginBottom: "4px" }}>{category.label}</div>
                  <div style={{ fontSize: "22px", fontWeight: 700, color: "#111827" }}>{category.maxScore}</div>
                </div>
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px", marginTop: "16px" }}>
              {SCORE_INTERPRETATION.map((band) => (
                <div key={band.label} style={miniCardStyle}>
                  <div style={{ fontSize: "15px", fontWeight: 700, color: "#111827" }}>{band.label}</div>
                  <div style={{ fontSize: "13px", color: "#6b7280", margin: "4px 0" }}>
                    {band.label === "Hot" ? "70-100" : band.label === "Warm" ? "40-69" : "0-39"}
                  </div>
                  <div style={{ fontSize: "13px", color: "#374151", lineHeight: 1.5 }}>{band.description}</div>
                </div>
              ))}
            </div>
          </HelpCard>

          <HelpCard title="Scoring Rubric">
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={tableHeaderStyle}>Category</th>
                    <th style={tableHeaderStyle}>Max Score</th>
                    <th style={tableHeaderStyle}>Criteria</th>
                  </tr>
                </thead>
                <tbody>
                  {SCORING_RUBRIC.map((category) => (
                    <tr key={category.key}>
                      <td style={tableCellStyle}>{category.label}</td>
                      <td style={tableCellStyle}>{category.maxScore}</td>
                      <td style={tableCellStyle}>
                        <div style={{ display: "grid", gap: "8px" }}>
                          {category.rules.map((rule) => (
                            <div key={`${category.key}-${rule.label}`}>
                              <strong>{rule.label}</strong>: {rule.points >= 0 ? `${rule.points} points` : `${rule.points} points`} - {rule.criteria}
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </HelpCard>

          <HelpCard title="Why This Matters">
            <p style={paragraphStyle}>
              Lead scoring helps agents prioritize response time, focus on the strongest opportunities first, and keep
              nurture leads organized without losing context. Because the score combines financial, behavioral, and fit
              signals, it gives a more realistic picture than any single field alone.
            </p>
          </HelpCard>

          <HelpCard title="How Notes Are Used">
            <p style={paragraphStyle}>
              Notes are parsed into structured signals like pre-approval, urgency, property type, location, and buyer
              constraints. Better notes create better scoring because the system has more deterministic evidence to work
              from. The parsing layer is intentionally lightweight today so it can be replaced by an LLM later without
              changing the product surface.
            </p>
          </HelpCard>
        </div>
      </section>
    </main>
  );
}

function HelpCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section
      style={{
        background: "white",
        borderRadius: "16px",
        padding: "24px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
      }}
    >
      <h2 style={{ marginTop: 0, marginBottom: "12px", color: "#111827" }}>{title}</h2>
      {children}
    </section>
  );
}

const paragraphStyle: React.CSSProperties = {
  margin: 0,
  color: "#374151",
  lineHeight: 1.7,
};

const miniCardStyle: React.CSSProperties = {
  background: "#f8fafc",
  border: "1px solid #e5e7eb",
  borderRadius: "12px",
  padding: "14px",
};

const tableHeaderStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "12px",
  borderBottom: "1px solid #e5e7eb",
  fontSize: "12px",
  color: "#6b7280",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const tableCellStyle: React.CSSProperties = {
  padding: "14px 12px",
  borderBottom: "1px solid #f3f4f6",
  verticalAlign: "top",
  fontSize: "14px",
  color: "#111827",
};
