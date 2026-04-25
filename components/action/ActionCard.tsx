"use client";

import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";

export type ActionCardVariant = "priority" | "inbox" | "week";

const variantClass: Record<ActionCardVariant, string> = {
  priority:
    "bg-gradient-to-br from-emerald-500/95 via-green-600/90 to-emerald-800/95 shadow-[0_20px_50px_-12px_rgba(22,163,74,0.45)] hover:shadow-[0_24px_60px_-10px_rgba(34,197,94,0.55)]",
  inbox:
    "bg-gradient-to-br from-emerald-950/95 via-teal-950/90 to-slate-950/95 shadow-[0_20px_50px_-12px_rgba(6,78,59,0.55)] hover:shadow-[0_24px_60px_-10px_rgba(20,184,166,0.35)]",
  week:
    "bg-gradient-to-br from-emerald-600/95 via-lime-900/75 to-indigo-950/70 shadow-[0_20px_50px_-12px_rgba(22,163,74,0.4)] hover:shadow-[0_24px_60px_-10px_rgba(99,102,241,0.25)]",
};

type ActionCardProps = {
  title: string;
  description: string;
  variant: ActionCardVariant;
  icon: LucideIcon;
  index: number;
  onSelect: () => void;
};

export function ActionCard({ title, description, variant, icon: Icon, index, onSelect }: ActionCardProps) {
  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, y: 28 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.55,
        delay: 0.12 + index * 0.08,
        ease: [0.22, 1, 0.36, 1],
      }}
      onClick={onSelect}
      className="group relative w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/80 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
    >
      <motion.div
        className={`relative overflow-hidden rounded-2xl p-6 text-white ${variantClass[variant]}`}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.99 }}
        transition={{ type: "spring", stiffness: 420, damping: 28 }}
      >
        <motion.div
          className="pointer-events-none absolute inset-0 opacity-40"
          animate={{ y: [0, -6, 0] }}
          transition={{ duration: 6 + index * 0.4, repeat: Infinity, ease: "easeInOut" }}
        >
          <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
        </motion.div>

        <div className="relative flex flex-col gap-3">
          <div className="flex items-start justify-between gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-black/15 backdrop-blur-sm">
              <Icon className="h-5 w-5 text-white/95" strokeWidth={1.75} />
            </span>
          </div>
          <div>
            <h3 className="text-lg font-semibold tracking-tight text-white">{title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-white/85">{description}</p>
          </div>
        </div>
      </motion.div>
    </motion.button>
  );
}
