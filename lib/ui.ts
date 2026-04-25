/** Shared input styling (forms, filters). */
export const inputFieldBase =
  "border border-slate-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white transition-all duration-200 ease-out focus:ring-2 focus:ring-emerald-500/70 focus:outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500";

export const inputFieldClass = `${inputFieldBase} w-full`;

/** Toolbar / inline fields where full width is undesirable */
export const inputFieldClassAuto = inputFieldBase;

/** Brand primary — solid */
export const primaryButton =
  "inline-flex items-center justify-center rounded-lg bg-gradient-to-r from-emerald-500 to-green-600 px-4 py-2 font-medium text-white shadow-[0_0_24px_rgba(34,197,94,0.25)] transition-all duration-200 ease-out hover:scale-[1.01] hover:from-emerald-400 hover:to-green-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:shadow-none";

/** Brand secondary — outline */
export const secondaryButton =
  "inline-flex items-center justify-center rounded-lg border border-slate-200 dark:border-neutral-800 bg-slate-100 dark:bg-neutral-800 px-4 py-2 text-slate-900 dark:text-white transition-all duration-200 ease-out hover:scale-[1.01] hover:bg-slate-200 dark:hover:bg-neutral-700 focus:outline-none focus:ring-2 focus:ring-emerald-500";
