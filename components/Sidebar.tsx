import Image from "next/image";
import Link from "next/link";

type SidebarProps = {
  active?: "dashboard" | "inbox" | "leads" | "appointments" | "settings" | "help";
};

const navInactive =
  "rounded-lg px-3 py-2.5 text-gray-700 no-underline outline-none transition-colors hover:bg-[#1bbff6]/20 hover:text-black focus-visible:ring-2 focus-visible:ring-[#1bbff6]";
const navActive =
  "rounded-lg bg-[#1bbff6] px-3 py-2.5 font-medium text-white no-underline outline-none transition-colors hover:bg-[#1aa8db] focus-visible:ring-2 focus-visible:ring-[#1bbff6]";

export function Sidebar({ active = "dashboard" }: SidebarProps) {
  return (
    <aside className="w-[220px] border-r border-gray-200 bg-white text-black">
      <div className="flex items-center px-4 py-4">
        <Link href="/" className="flex items-center">
          <Image
            src="/flowleads.png"
            alt="FlowLeads Logo"
            width={120}
            height={40}
            className="object-contain"
            priority
          />
        </Link>
      </div>

      <nav className="flex flex-col gap-3 px-4 pb-6">
        <Link href="/" className={active === "dashboard" ? navActive : navInactive}>
          Dashboard
        </Link>
        <Link href="/inbox" className={active === "inbox" ? navActive : navInactive}>
          Inbox
        </Link>
        <Link href="/leads" className={active === "leads" ? navActive : navInactive}>
          Leads
        </Link>
        <Link href="/appointments" className={active === "appointments" ? navActive : navInactive}>
          Appointments
        </Link>
        <Link href="/settings" className={active === "settings" ? navActive : navInactive}>
          Settings
        </Link>
        <Link href="/help" className={active === "help" ? navActive : navInactive}>
          Help
        </Link>
      </nav>
    </aside>
  );
}
