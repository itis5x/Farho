import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { parseLayout } from "@/lib/builder/schema";
import { getStorefront } from "@/lib/store-data";

async function load(slug: string, pageSlug: string) {
  const { store, hidden } = await getStorefront(slug);
  const page = parseLayout(store.layout, store).pages.find((p) => p.slug === pageSlug);
  return { store, hidden, page };
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string; page: string }> }): Promise<Metadata> {
  const { slug, page } = await params;
  const { page: p } = await load(slug, page);
  return { title: p?.title };
}

export default async function CustomPage({ params }: { params: Promise<{ slug: string; page: string }> }) {
  const { slug, page: pageSlug } = await params;
  const { hidden, page } = await load(slug, pageSlug);
  if (hidden) return null;
  if (!page) notFound();
  return (
    <article className="mx-auto max-w-3xl px-4 py-14">
      <h1 className="text-3xl font-bold">{page.title}</h1>
      <div className="mt-6 space-y-4 leading-relaxed text-zinc-700">
        {page.body.split(/\n{2,}/).map((para, i) => (
          <p key={i} className="whitespace-pre-line">{para}</p>
        ))}
      </div>
    </article>
  );
}
