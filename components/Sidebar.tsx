import Image from "next/image";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  CalendarDays,
  HelpCircle,
  Inbox,
  LayoutDashboard,
  Settings,
  Sparkles,
  Users,
} from "lucide-react";

export type SidebarActive =
  | "action"
  | "dashboard"
  | "inbox"
  | "leads"
  | "calendar"
  | "settings"
  | "help";

type SidebarProps = {
  active?: SidebarActive;
};

const linkBase =
  "group relative flex items-center gap-3 rounded-xl py-2.5 pl-3 pr-3 text-sm font-medium no-underline outline-none transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-emerald-500/45 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-50 dark:focus-visible:ring-offset-zinc-950";

function NavLink({
  href,
  label,
  active,
  icon: Icon,
}: {
  href: string;
  label: string;
  active: boolean;
  icon: LucideIcon;
}) {
  return (
    <Link
      href={href}
      className={`${linkBase} ${
        active
          ? "bg-emerald-500/12 text-emerald-700 shadow-[inset_0_0_0_1px_rgba(52,211,153,0.14)] dark:text-emerald-300"
          : "text-slate-600 hover:bg-emerald-500/[0.06] hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-200"
      }`}
    >
      {active && (
        <span
          className="absolute left-0 top-1/2 h-7 w-[3px] -translate-y-1/2 rounded-full bg-emerald-400 shadow-[0_0_14px_rgba(52,211,153,0.55)]"
          aria-hidden
        />
      )}
      <Icon
        className={`h-[18px] w-[18px] shrink-0 transition-colors ${
          active ? "text-emerald-400" : "text-slate-500 group-hover:text-emerald-500 dark:text-zinc-500 dark:group-hover:text-emerald-400/80"
        }`}
        strokeWidth={1.75}
      />
      {label}
    </Link>
  );
}

export function Sidebar({ active = "dashboard" }: SidebarProps) {
  return (
    <aside className="flex w-[232px] shrink-0 flex-col border-r border-slate-200 bg-white text-slate-900 dark:border-white/[0.06] dark:bg-zinc-950 dark:text-zinc-100">
      <div className="flex items-center px-4 py-5">
        <Link href="/action" className="flex items-center transition-opacity duration-200 hover:opacity-90">
          <Image
            src="/grassleads.png"
            alt="GrassLeads"
            width={120}
            height={40}
            className="object-contain brightness-110 contrast-105"
            priority
          />
        </Link>
      </div>

      <nav className="flex flex-col gap-0.5 px-3 pb-8">
        <NavLink href="/action" label="Seed" active={active === "action"} icon={Sparkles} />
        <NavLink href="/" label="Dashboard" active={active === "dashboard"} icon={LayoutDashboard} />
        <NavLink href="/inbox" label="Inbox" active={active === "inbox"} icon={Inbox} />
        <NavLink href="/leads" label="Leads" active={active === "leads"} icon={Users} />
        <NavLink href="/calendar" label="Calendar" active={active === "calendar"} icon={CalendarDays} />
        <NavLink href="/settings" label="Settings" active={active === "settings"} icon={Settings} />
        <NavLink href="/help" label="Help" active={active === "help"} icon={HelpCircle} />
      </nav>
    </aside>
  );
}
