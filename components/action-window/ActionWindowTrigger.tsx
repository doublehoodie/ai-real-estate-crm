"use client";

import { Sparkles } from "lucide-react";

type ActionWindowTriggerProps = {
  visible: boolean;
  onClick: () => void;
  label?: string;
};

export function ActionWindowTrigger({ visible, onClick, label = "Seed" }: ActionWindowTriggerProps) {
  if (!visible) return null;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full border border-gray-200/80 bg-white text-gray-800 shadow-[0_8px_30px_rgba(0,0,0,0.08)] transition-all hover:border-gray-300 hover:shadow-[0_12px_40px_rgba(0,0,0,0.12)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1AB523] focus-visible:ring-offset-2"
    >
      <Sparkles className="h-6 w-6 text-[#1AB523]" strokeWidth={1.75} aria-hidden />
    </button>
  );
}
