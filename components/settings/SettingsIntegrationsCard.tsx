"use client";

import { CSVUploader } from "@/components/import/CSVUploader";

export function SettingsIntegrationsCard() {
  return (
    <CSVUploader>
      {({ openPicker, importing }) => (
        <section className="rounded-2xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6 shadow-lg backdrop-blur-md">
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">Integrations</h3>
          <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">Import leads from CSV into your workspace database.</p>
          <div className="mt-4">
            <button
              type="button"
              onClick={openPicker}
              disabled={importing}
              className={`rounded-md px-3 py-2 text-sm font-medium ${
                importing
                  ? "cursor-default border border-slate-200 dark:border-neutral-800 bg-slate-100 dark:bg-neutral-800 text-slate-500 dark:text-slate-400"
                  : "border border-emerald-500/60 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-green-600 hover:text-white"
              }`}
            >
              {importing ? "Importing..." : "Import CSV"}
            </button>
          </div>
        </section>
      )}
    </CSVUploader>
  );
}
