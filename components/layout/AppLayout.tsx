import type { ReactNode } from "react";
import { Sidebar, type SidebarActive } from "@/components/Sidebar";

type AppLayoutProps = {
  active: SidebarActive;
  title: string;
  description?: string;
  children: ReactNode;
};

export function AppLayout({ active, title, description, children }: AppLayoutProps) {
  return (
    <main className="flex min-h-screen bg-slate-50 text-slate-900 dark:bg-neutral-950 dark:text-zinc-100">
      <Sidebar active={active} />
      <section className="flex min-h-screen flex-1 flex-col bg-slate-50 dark:bg-neutral-950">
        <div className="mx-auto w-full max-w-7xl px-6 py-8">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">{title}</h1>
          {description ? <p className="mt-2 text-sm text-slate-600 dark:text-zinc-400">{description}</p> : null}
          <div className="mt-8">{children}</div>
        </div>
      </section>
    </main>
  );
}
