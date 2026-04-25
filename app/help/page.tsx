import { AppLayout } from "@/components/layout/AppLayout";
import { SCORING_RUBRIC, SCORE_INTERPRETATION } from "@/lib/scoring";

export default function HelpPage() {
  return (
    <AppLayout
      active="help"
      title="Help"
      description="This CRM uses an explainable lead scoring model so agents can quickly prioritize the leads most likely to convert."
    >
      <div className="grid gap-5">
        <HelpCard title="How Lead Scoring Works">
            <p style={paragraphStyle}>
              Every lead receives a score from 0 to 100 across five categories. The model blends financial readiness,
              urgency, buying intent, fit quality, and data confidence into one deterministic score.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px" }}>
              {SCORING_RUBRIC.map((category) => (
                <div key={category.key} style={miniCardStyle}>
                  <div style={{ fontSize: "13px", color: "#334155", marginBottom: "4px" }}>{category.label}</div>
                  <div style={{ fontSize: "22px", fontWeight: 700, color: "#0f172a" }}>{category.maxScore}</div>
                </div>
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px", marginTop: "16px" }}>
              {SCORE_INTERPRETATION.map((band) => (
                <div key={band.label} style={miniCardStyle}>
                  <div style={{ fontSize: "15px", fontWeight: 700, color: "#0f172a" }}>{band.label}</div>
                  <div style={{ fontSize: "13px", color: "#334155", margin: "4px 0" }}>
                    {band.label === "Hot" ? "70-100" : band.label === "Warm" ? "40-69" : "0-39"}
                  </div>
                  <div style={{ fontSize: "13px", color: "#334155", lineHeight: 1.5 }}>{band.description}</div>
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
    </AppLayout>
  );
}

function HelpCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6 shadow-lg backdrop-blur-md">
      <h2 className="mb-3 mt-0 text-lg font-semibold tracking-tight text-slate-900 dark:text-white">{title}</h2>
      {children}
    </section>
  );
}

const paragraphStyle: React.CSSProperties = {
  margin: 0,
  color: "#334155",
  lineHeight: 1.7,
};

const miniCardStyle: React.CSSProperties = {
  background: "white",
  border: "1px solid rgb(226 232 240)",
  borderRadius: "12px",
  padding: "14px",
};

const tableHeaderStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "12px",
  borderBottom: "1px solid rgb(226 232 240)",
  fontSize: "12px",
  color: "#334155",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const tableCellStyle: React.CSSProperties = {
  padding: "14px 12px",
  borderBottom: "1px solid rgb(226 232 240)",
  verticalAlign: "top",
  fontSize: "14px",
  color: "#334155",
};
