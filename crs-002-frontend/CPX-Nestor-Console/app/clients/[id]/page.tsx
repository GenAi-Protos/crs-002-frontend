"use client";

import { use } from "react";
import { ClientsScreen } from "@/components/clients/ClientsScreen";

export default function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <ClientsScreen selectedId={id} />;
}
