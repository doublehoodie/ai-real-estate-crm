"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { importCSV } from "@/lib/import/importCSV";
import { appendAssistantSessionLine } from "@/lib/stores/assistantSessionStore";
import { supabase } from "@/lib/supabaseClient";

type CSVUploaderRenderArgs = {
  openPicker: () => void;
  importing: boolean;
};

type CSVUploaderProps = {
  onImported?: (count: number) => void;
  children: (args: CSVUploaderRenderArgs) => React.ReactNode;
};

export function CSVUploader({ onImported, children }: CSVUploaderProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [importing, setImporting] = useState(false);

  async function onFile(file: File) {
    console.log("FILE SELECTED:", file.name);
    setImporting(true);
    try {
      const count = await importCSV(file);
      if (count > 0) {
        appendAssistantSessionLine(`You’ve imported ${count} leads. Start with these.`);
      }
      onImported?.(count);
      if (count > 0) {
        await router.refresh();
        console.log("REFRESH TRIGGERED");
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();
        if (userError) {
          console.error("LEADS FETCH AFTER INSERT USER ERROR:", userError);
          return;
        }
        if (!user?.id) {
          console.error("LEADS FETCH AFTER INSERT USER MISSING");
          return;
        }
        const { data: leadsAfter, error: leadsError } = await supabase
          .from("leads")
          .select("*")
          .eq("user_id", user.id);
        if (leadsError) {
          console.error("LEADS FETCH AFTER INSERT ERROR:", leadsError);
        } else {
          console.log("LEADS AFTER INSERT:", leadsAfter);
        }
      }
    } catch (e) {
      console.error("[CSV IMPORT]", e);
    } finally {
      setImporting(false);
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void onFile(file);
          e.currentTarget.value = "";
        }}
      />
      {children({
        openPicker: () => inputRef.current?.click(),
        importing,
      })}
    </>
  );
}
