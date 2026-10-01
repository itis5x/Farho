"use client";

import { useActionState } from "react";
import { FormMessage, SubmitButton } from "@/components/form";
import { importProducts } from "@/lib/actions/import";

export function ImportForm({ storeId }: { storeId: string }) {
  const [state, action] = useActionState(importProducts.bind(null, storeId), undefined);
  return (
    <form action={action} className="card space-y-3 p-5">
      <input type="file" name="file" accept=".csv,text/csv" required className="text-sm" />
      <FormMessage state={state} />
      <SubmitButton pendingText="Importing…">Import products</SubmitButton>
    </form>
  );
}
