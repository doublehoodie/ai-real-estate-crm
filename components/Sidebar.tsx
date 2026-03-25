import Link from "next/link";

type SidebarProps = {
  active?: "dashboard" | "inbox" | "leads" | "appointments" | "settings" | "help";
};

export function Sidebar({ active = "dashboard" }: SidebarProps) {
  return (
    <aside
      style={{
        width: "220px",
        background: "#111827",
        color: "white",
        padding: "24px 16px",
      }}
    >
      <h2 style={{ marginTop: 0, marginBottom: "24px", color: "white" }}>CRM</h2>

      <nav style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        <Link
          href="/"
          style={{ textDecoration: "none", color: "inherit" }}
        >
          <div style={active === "dashboard" ? navItemActive : navItem}>Dashboard</div>
        </Link>
        <Link
          href="/inbox"
          style={{ textDecoration: "none", color: "inherit" }}
        >
          <div style={active === "inbox" ? navItemActive : navItem}>Inbox</div>
        </Link>
        <Link
          href="/leads"
          style={{ textDecoration: "none", color: "inherit" }}
        >
          <div style={active === "leads" ? navItemActive : navItem}>Leads</div>
        </Link>
        <Link
          href="/appointments"
          style={{ textDecoration: "none", color: "inherit" }}
        >
          <div style={active === "appointments" ? navItemActive : navItem}>Appointments</div>
        </Link>
        <Link
          href="/settings"
          style={{ textDecoration: "none", color: "inherit" }}
        >
          <div style={active === "settings" ? navItemActive : navItem}>Settings</div>
        </Link>
        <Link
          href="/help"
          style={{ textDecoration: "none", color: "inherit" }}
        >
          <div style={active === "help" ? navItemActive : navItem}>Help</div>
        </Link>
      </nav>
    </aside>
  );
}

const navItem: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: "8px",
  color: "#d1d5db",
};

const navItemActive: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: "8px",
  background: "#1f2937",
  color: "white",
  fontWeight: 700,
};
