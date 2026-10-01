import Link from "next/link";
import { Logo } from "@/components/logo";
import { CreateStoreForm } from "./form";

export const metadata = { title: "Create a store" };

export default function NewStorePage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Link href="/dashboard">
        <Logo />
      </Link>
      <div className="card mt-8 p-8">
        <h1 className="text-2xl font-bold">Create your store</h1>
        <p className="mt-1 text-sm text-zinc-600">
          You can change everything later from your store&apos;s admin panel.
        </p>
        <CreateStoreForm />
      </div>
      <p className="mt-6 text-center text-sm">
        <Link href="/dashboard" className="text-zinc-600 hover:underline">
          ← Back to your stores
        </Link>
      </p>
    </div>
  );
}
