"use client";

import Link from "next/link";
import { useActionState } from "react";
import { login } from "../actions";
import { FormMessage, SubmitButton } from "@/components/form";

export default function LoginPage() {
  const [state, action] = useActionState(login, undefined);
  return (
    <>
      <h1 className="text-2xl font-bold">Welcome back</h1>
      <p className="mt-1 text-sm text-zinc-600">Log in to manage your stores.</p>
      <form action={action} className="mt-6 space-y-4">
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input className="input" id="email" name="email" type="email" required autoComplete="email" />
        </div>
        <div>
          <label className="label" htmlFor="password">Password</label>
          <input className="input" id="password" name="password" type="password" required autoComplete="current-password" />
        </div>
        <FormMessage state={state} />
        <SubmitButton className="btn-primary w-full">Log in</SubmitButton>
      </form>
      <p className="mt-6 text-center text-sm text-zinc-600">
        New to Farho?{" "}
        <Link href="/signup" className="font-medium text-indigo-600 hover:underline">
          Create an account
        </Link>
      </p>
    </>
  );
}
