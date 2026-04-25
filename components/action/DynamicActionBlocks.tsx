"use client";

import { motion } from "framer-motion";
import type { ResolvedActionConfig } from "@/lib/action/actionEngine";

type DynamicActionBlocksProps = {
  actions: ResolvedActionConfig[];
};

function cardClass(index: number): string {
  if (index === 0) return "mx-auto w-full max-w-2xl";
  return "w-full";
}

export function DynamicActionBlocks({ actions }: DynamicActionBlocksProps) {
  if (actions.length === 0) return null;
  const primary = actions[0] ? [actions[0]] : [];
  const secondary = actions.slice(1);

  return (
    <div className="mx-auto mt-12 w-full max-w-4xl space-y-4">
      <div className="grid grid-cols-1 gap-4">
        {primary.map((action, index) => {
          const Icon = action.icon;
          return (
            <motion.button
              key={action.id}
              type="button"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
              className={`${cardClass(index)} rounded-2xl border border-emerald-400/40 bg-gradient-to-br from-emerald-500/90 via-green-600/85 to-emerald-900/95 p-6 text-left text-white shadow-[0_20px_60px_-10px_rgba(34,197,94,0.45)] transition hover:scale-[1.01]`}
              onClick={() => void action.handler()}
            >
              <div className="flex items-start gap-3">
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-black/15">
                  <Icon className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="text-lg font-semibold">{action.label}</p>
                  <p className="mt-1.5 text-sm text-white/90">{action.description}</p>
                </div>
              </div>
            </motion.button>
          );
        })}
      </div>

      {secondary.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {secondary.map((action, index) => {
            const Icon = action.icon;
            return (
              <motion.button
                key={action.id}
                type="button"
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, delay: 0.14 + index * 0.06, ease: [0.22, 1, 0.36, 1] }}
                className="rounded-xl border border-white/15 bg-zinc-900/70 p-4 text-left text-white transition hover:border-emerald-400/45 hover:bg-zinc-800/70"
                onClick={() => void action.handler()}
              >
                <div className="flex items-start gap-2.5">
                  <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10">
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{action.label}</p>
                    <p className="mt-1 text-xs text-zinc-300">{action.description}</p>
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>
      )}
    </div>
  );
}
