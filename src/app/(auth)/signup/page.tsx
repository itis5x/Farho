"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signup } from "../actions";
import { FormMessage, SubmitButton } from "@/components/form";

export default function SignupPage() {
  const [state, action] = useActionState(signup, undefined);
  return (
    <>
      <h1 className="text-2xl font-bold">Create your account</h1>
      <p className="mt-1 text-sm text-zinc-600">Launch your online store in minutes.</p>
      <form action={action} className="mt-6 space-y-4">
        <div>
          <label className="label" htmlFor="name">Full name</label>
          <input className="input" id="name" name="name" required autoComplete="name" />
        </div>
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input className="input" id="email" name="email" type="email" required autoComplete="email" />
        </div>
        <div>
          <label className="label" htmlFor="password">Password</label>
          <input className="input" id="password" name="password" type="password" required minLength={8} autoComplete="new-password" />
          <p className="mt-1 text-xs text-zinc-500">At least 8 characters.</p>
        </div>
        <FormMessage state={state} />
        <SubmitButton className="btn-primary w-full">Create account</SubmitButton>
      </form>
      <p className="mt-6 text-center text-sm text-zinc-600">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-indigo-600 hover:underline">
          Log in
        </Link>
      </p>
    </>
  );
}
