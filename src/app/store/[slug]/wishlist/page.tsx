import { WishlistPage } from "@/components/storefront/wishlist";
import { getStorefront } from "@/lib/store-data";

export const metadata = { title: "Wishlist" };

export default async function Wishlist({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { store, hidden } = await getStorefront(slug);
  if (hidden) return null;
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="mb-6 text-3xl font-bold">Your wishlist</h1>
      <WishlistPage store={store.slug} base={`/store/${store.slug}`} currency={store.currency} />
    </div>
  );
}
