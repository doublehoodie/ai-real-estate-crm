import { Suspense } from "react";
import { BrandName } from "@/components/BrandName";
import { LoginForm } from "./LoginForm";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[#f3f4f6] px-6 transition-all duration-200">
          <div className="flex flex-col items-center gap-3 text-center">
            <BrandName className="text-lg text-gray-900" />
            <p className="text-sm text-gray-500">Loading…</p>
          </div>
        </main>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
