import { AppLayout } from "@/components/layout/AppLayout";
import { SettingsIntegrationsCard } from "@/components/settings/SettingsIntegrationsCard";
import { SettingsThemeCard } from "@/components/settings/SettingsThemeCard";

export default function SettingsPage() {
  return (
    <AppLayout active="settings" title="Settings" description="Manage workspace preferences.">
      <div className="space-y-4">
        <div className="rounded-2xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6 shadow-lg backdrop-blur-md">
          <SettingsThemeCard />
        </div>
        <SettingsIntegrationsCard />
      </div>
    </AppLayout>
  );
}

