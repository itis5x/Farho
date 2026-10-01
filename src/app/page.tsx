import Link from "next/link";
import { Logo } from "@/components/logo";
import { getCurrentUser } from "@/lib/auth";

const features = [
  {
    title: "Website builder",
    body: "Pick a theme, set your brand colours, logo and banner, and see your storefront update live.",
    icon: "🎨",
  },
  {
    title: "Order management",
    body: "Every order lands in your admin panel. Confirm, ship, deliver and track payments in a few clicks.",
    icon: "📦",
  },
  {
    title: "Products & inventory",
    body: "Add products with photos, prices, discounts and stock. Out-of-stock items stop selling automatically.",
    icon: "🏷️",
  },
  {
    title: "Customers",
    body: "Build a customer list automatically from every checkout, with order history and lifetime spend.",
    icon: "👥",
  },
  {
    title: "Coupons & delivery",
    body: "Create discount codes, set delivery charges and free-delivery thresholds for your store.",
    icon: "🎟️",
  },
  {
    title: "Cash on delivery",
    body: "Accept orders with cash on delivery out of the box. Customers can track their order status online.",
    icon: "💵",
  },
];

export default async function Home() {
  const user = await getCurrentUser();
  return (
    <div className="min-h-screen bg-white">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5">
        <Logo />
        <nav className="flex items-center gap-3">
          {user ? (
            <Link href="/dashboard" className="btn-primary">
              Go to dashboard
            </Link>
          ) : (
            <>
              <Link href="/login" className="btn text-zinc-700 hover:bg-zinc-100">
                Log in
              </Link>
              <Link href="/signup" className="btn-primary">
                Start free
              </Link>
            </>
          )}
        </nav>
      </header>

      <section className="mx-auto max-w-6xl px-4 pb-20 pt-16 text-center">
        <span className="badge bg-indigo-50 text-indigo-700 normal-case">Your store, online in minutes</span>
        <h1 className="mx-auto mt-6 max-w-3xl text-5xl font-extrabold tracking-tight text-zinc-900 sm:text-6xl">
          Build your website. <span className="text-indigo-600">Sell anything.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-zinc-600">
          Farho gives you a beautiful online store and a powerful admin panel to manage products,
          orders and customers — no coding required.
        </p>
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <Link href={user ? "/dashboard/new" : "/signup"} className="btn-primary px-6 py-3 text-base">
            Create your store
          </Link>
          <Link href="/store/demo" className="btn-secondary px-6 py-3 text-base">
            View demo store
          </Link>
        </div>
      </section>

      <section className="border-t border-zinc-100 bg-zinc-50 py-20">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-center text-3xl font-bold">Everything you need to sell online</h2>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div key={f.title} className="card p-6">
                <div className="text-3xl">{f.icon}</div>
                <h3 className="mt-4 font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm text-zinc-600">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-20">
        <h2 className="text-center text-3xl font-bold">Three steps to your first sale</h2>
        <ol className="mt-12 grid gap-6 sm:grid-cols-3">
          {[
            ["Create your store", "Pick a name and a web address for your shop."],
            ["Add products & design", "Upload products and customise your website's look."],
            ["Share & sell", "Share your store link and manage incoming orders."],
          ].map(([title, body], i) => (
            <li key={title} className="card p-6">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-indigo-600 font-bold text-white">
                {i + 1}
              </span>
              <h3 className="mt-4 font-semibold">{title}</h3>
              <p className="mt-2 text-sm text-zinc-600">{body}</p>
            </li>
          ))}
        </ol>
      </section>

      <footer className="border-t border-zinc-100 py-8 text-center text-sm text-zinc-500">
        © {new Date().getFullYear()} Farho. Built for sellers.
      </footer>
    </div>
  );
}
