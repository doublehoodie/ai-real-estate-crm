"use client";

import { FloatingCalendarEditor } from "@/components/execution/FloatingCalendarEditor";
import { FloatingCompose } from "@/components/execution/FloatingCompose";

export function GlobalExecutionLayers() {
  return (
    <>
      <FloatingCompose />
      <FloatingCalendarEditor />
    </>
  );
}
