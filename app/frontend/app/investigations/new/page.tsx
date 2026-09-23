"use client";

// The create dialog opens over the case list rather than a blank tab; closing
// it returns to /investigations.

import { CaseList } from "@/components/investigations/CaseList";

export default function NewInvestigationPage() {
  return <CaseList creating />;
}
