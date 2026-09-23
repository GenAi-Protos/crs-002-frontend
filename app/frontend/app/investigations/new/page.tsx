"use client";

import { useRouter } from "next/navigation";
import { CaseForm } from "@/components/investigations/CaseForm";
import { canSee } from "@/lib/access";
import { useConsoleUser } from "@/lib/role-context";

export default function NewInvestigationPage() {
  const router = useRouter();
  const { user } = useConsoleUser();
  if (!canSee(user.role, "investigations")) return <p className="p-6">Not permitted at this access level.</p>;
  return <CaseForm onClose={() => router.replace("/investigations")} onCreated={(item) => router.replace(`/investigations/${item.id}`)} />;
}
