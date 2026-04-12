import { Suspense } from "react";
import { LoginForm } from "./LoginForm";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <p style={{ color: "#6b7280" }}>Loading…</p>
        </main>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
