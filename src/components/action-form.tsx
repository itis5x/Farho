"use client";

import { useActionState, useEffect, useRef } from "react";
import { FormMessage } from "@/components/form";
import type { FormState } from "@/lib/types";

/** A form bound to a server action that returns FormState; resets on success. */
export function ActionForm({
  action,
  children,
  className,
}: {
  action: (prev: FormState, form: FormData) => Promise<FormState>;
  children: React.ReactNode;
  className?: string;
}) {
  const [state, formAction] = useActionState(action, undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state]);
  return (
    <form ref={ref} action={formAction} className={className}>
      {children}
      <div className="mt-3">
        <FormMessage state={state} />
      </div>
    </form>
  );
}
