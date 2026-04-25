"use client";

import Papa from "papaparse";
import { supabase } from "@/lib/supabaseClient";

type CSVRow = { name?: unknown; email?: unknown; phone?: unknown; notes?: unknown };

function asText(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

export async function importCSV(file: File): Promise<number> {
  console.log("CSV IMPORT TRIGGERED");
  const text = await file.text();
  const parsed = Papa.parse<CSVRow>(text, {
    header: true,
    skipEmptyLines: true,
  });

  const data = parsed.data;
  console.log("PARSED DATA:", data);
  console.log("ROW COUNT:", data.length);

  const mappedRows = data
    .map((row) => ({
      name: asText(row.name),
      email: asText(row.email),
      phone: asText(row.phone),
      notes: asText(row.notes),
    }))
    .filter((row) => row.name.length > 0 && (row.email.length > 0 || row.phone.length > 0));

  console.log("ROWS PARSED (valid for insert):", mappedRows.length);
  console.log("MAPPED ROWS:", mappedRows);

  if (mappedRows.length === 0) {
    console.warn("MAPPED ROWS EMPTY: skip insert (need name + email or phone)");
    return 0;
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError) {
    throw userError;
  }
  const userId = user?.id;
  if (!userId) {
    throw new Error("Must be logged in to import CSV leads.");
  }

  /** DB row shape (RLS + schema); not the same as CSV `mappedRows` alone. */
  const insertPayload = mappedRows.map((row) => ({
    user_id: userId,
    name: row.name || null,
    email: row.email || null,
    phone: row.phone || null,
    notes: row.notes || null,
    status: "new",
    status_confidence: 80,
  }));

  const { data: inserted, error } = await supabase.from("leads").insert(insertPayload).select("id");
  if (error) {
    console.error("INSERT ERROR:", error);
    throw error;
  }
  console.log("INSERT SUCCESS:", inserted);

  const count = inserted?.length ?? insertPayload.length;
  console.log("ROWS INSERTED:", count);
  console.log("INSERTED ROWS:", count);
  console.log("INSERTED ROW COUNT:", mappedRows.length);
  return count;
}
