import type { FontChoice, Theme } from "@/lib/types";
import { newId, section, type Section } from "./schema";

export type Template = {
  id: string;
  name: string;
  description: string;
  preview: [string, string]; // gradient colours for the picker card
  theme: Theme;
  primary_color: string;
  font: FontChoice;
  announcement: string;
  custom_css?: string;
  sections: (storeName: string) => Section[];
};

const img = (seed: string, w = 1600, h = 900) => `https://picsum.photos/seed/${seed}/${w}/${h}`;
const s = (v: Record<string, unknown>) => section.parse({ id: newId(), ...v });
const perks = (items: [string, string, string][]) => s({ type: "perks", items: items.map(([icon, title, text]) => ({ icon, title, text })) });

export const TEMPLATES: Template[] = [
  {
    id: "boutique",
    name: "Boutique",
    description: "Elegant fashion store with lookbook and story.",
    preview: ["#f5e6e0", "#b76e79"],
    theme: "minimal",
    primary_color: "#b76e79",
    font: "serif",
    announcement: "Free delivery on orders over Rs. 3,000 ✨",
    sections: (name) => [
      s({ type: "hero", style: "centered", title: `${name}`, subtitle: "Timeless pieces, made to be loved for years.", image: img("boutique-hero"), button_text: "Shop the collection", button_link: "/products" }),
      s({ type: "products", title: "New in", source: "newest", limit: 8 }),
      s({ type: "image_text", title: "Crafted with care", text: "Every piece is chosen for its quality and comfort. We work with small makers and pay them fairly.", image: img("boutique-story", 900, 900), image_side: "right" }),
      s({ type: "gallery", title: "Lookbook", images: [1, 2, 3, 4, 5, 6].map((i) => img(`look-${i}`, 600, 800)) }),
      s({ type: "testimonials", title: "Loved by our customers", items: [{ name: "Anusha", text: "The fabric is gorgeous and it fits perfectly.", rating: 5 }, { name: "Prerana", text: "Fast delivery and beautiful packaging!", rating: 5 }, { name: "Riya", text: "My go-to store for gifts.", rating: 5 }] }),
    ],
  },
  {
    id: "techhub",
    name: "Tech Hub",
    description: "Bold electronics & gadgets store with deals.",
    preview: ["#0f172a", "#06b6d4"],
    theme: "modern",
    primary_color: "#0891b2",
    font: "sans",
    announcement: "⚡ 1-year warranty on all gadgets · Cash on delivery",
    sections: (name) => [
      s({ type: "hero", style: "split", title: "The latest tech, delivered fast", subtitle: `${name} brings you genuine gadgets with warranty.`, image: img("tech-hero", 1000, 1000), button_text: "Browse deals", button_link: "/products" }),
      perks([["🛡️", "Genuine products", "With official warranty"], ["🚚", "Next-day delivery", "Inside the valley"], ["💳", "Pay your way", "eSewa, Khalti, COD"]]),
      s({ type: "countdown", title: "Mega deal ends in", text: "Extra discounts on top picks", ends_at: new Date(Date.now() + 5 * 86_400_000).toISOString().slice(0, 16), button_text: "Grab the deal", button_link: "/products" }),
      s({ type: "products", title: "Hot deals", source: "sale", limit: 8 }),
      s({ type: "categories", title: "Shop by category" }),
      s({ type: "products", title: "Just landed", source: "newest", limit: 8 }),
      s({ type: "faq", title: "Questions?", items: [{ q: "Are your products genuine?", a: "Yes — every product comes with an official warranty card." }, { q: "Can I pay on delivery?", a: "Absolutely. Cash on delivery is available everywhere we deliver." }] }),
    ],
  },
  {
    id: "freshmart",
    name: "Fresh Mart",
    description: "Groceries, bakery or restaurant — bright and friendly.",
    preview: ["#ecfccb", "#16a34a"],
    theme: "classic",
    primary_color: "#16a34a",
    font: "sans",
    announcement: "🥬 Order before 2pm for same-day delivery",
    sections: () => [
      s({ type: "hero", style: "overlay", title: "Fresh to your door", subtitle: "Farm-fresh produce and daily essentials, delivered today.", image: img("grocery-hero"), button_text: "Start shopping", button_link: "/products" }),
      perks([["⏱️", "Same-day delivery", "Order before 2pm"], ["🌱", "Fresh guarantee", "Or your money back"], ["💵", "Cash on delivery", "No extra charge"]]),
      s({ type: "categories", title: "What do you need today?" }),
      s({ type: "products", title: "Best sellers", source: "featured", limit: 12 }),
      s({ type: "banner", title: "Weekend basket offer", text: "Get 10% off orders above Rs. 2,000", button_text: "Order now", button_link: "/products", tone: "brand" }),
    ],
  },
  {
    id: "handmade",
    name: "Handmade",
    description: "Warm, earthy look for crafts and artisan goods.",
    preview: ["#fef3c7", "#b45309"],
    theme: "classic",
    primary_color: "#b45309",
    font: "serif",
    announcement: "Handmade in Nepal 🇳🇵 · Every purchase supports local artisans",
    sections: (name) => [
      s({ type: "hero", style: "overlay", title: "Made by hand, with heart", subtitle: `${name} works with artisans across Nepal.`, image: img("handmade-hero"), button_text: "Explore", button_link: "/products" }),
      s({ type: "products", title: "Featured crafts", source: "featured", limit: 8 }),
      s({ type: "image_text", title: "Meet our makers", text: "From Bhaktapur potters to Pokhara weavers, every item tells a story. Fair wages, natural materials, timeless skills.", image: img("artisan", 900, 900) }),
      s({ type: "categories", title: "Browse collections" }),
      s({ type: "video", title: "How it's made", url: "" }),
    ],
  },
  {
    id: "glow",
    name: "Glow Beauty",
    description: "Soft, glossy skincare & cosmetics store.",
    preview: ["#fce7f3", "#db2777"],
    theme: "modern",
    primary_color: "#db2777",
    font: "sans",
    announcement: "💖 Free gift with every order above Rs. 2,500",
    sections: () => [
      s({ type: "hero", style: "gradient", title: "Your glow, your rules", subtitle: "Clean skincare and makeup, 100% authentic.", button_text: "Shop beauty", button_link: "/products" }),
      s({ type: "products", title: "Trending now", source: "featured", limit: 8, layout: "carousel" }),
      perks([["✅", "100% authentic", "Sourced from brands"], ["🎁", "Free samples", "With every order"], ["↩️", "Easy returns", "Unopened items"]]),
      s({ type: "testimonials", title: "Real reviews", items: [{ name: "Sneha", text: "My skin has never looked better!", rating: 5 }, { name: "Kriti", text: "Authentic products and quick delivery.", rating: 5 }] }),
      s({ type: "products", title: "On sale", source: "sale", limit: 8 }),
    ],
  },
  {
    id: "street",
    name: "Streetwear",
    description: "Loud, high-contrast drops for streetwear brands.",
    preview: ["#111111", "#facc15"],
    theme: "modern",
    primary_color: "#111111",
    font: "mono",
    announcement: "NEW DROP — LIMITED STOCK 🔥",
    custom_css: ".font-mono h1, .font-mono h2 { text-transform: uppercase; letter-spacing: 0.05em; }",
    sections: () => [
      s({ type: "hero", style: "overlay", title: "DROP 04 IS LIVE", subtitle: "Limited pieces. No restocks.", image: img("street-hero"), button_text: "Cop now", button_link: "/products" }),
      s({ type: "countdown", title: "Drop closes in", text: "", ends_at: new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 16), button_text: "Shop the drop", button_link: "/products" }),
      s({ type: "products", title: "The drop", source: "newest", limit: 8 }),
      s({ type: "gallery", title: "#WornByYou", images: [1, 2, 3, 4].map((i) => img(`street-${i}`, 700, 700)) }),
    ],
  },
  {
    id: "luxe",
    name: "Luxe",
    description: "Black & gold premium look for jewellery and watches.",
    preview: ["#0c0a09", "#ca8a04"],
    theme: "minimal",
    primary_color: "#a16207",
    font: "serif",
    announcement: "Complimentary gift wrapping on every order",
    sections: (name) => [
      s({ type: "hero", style: "centered", title: name, subtitle: "Fine pieces for life's finest moments.", image: img("luxe-hero"), button_text: "Discover", button_link: "/products" }),
      s({ type: "products", title: "Signature collection", source: "featured", limit: 4 }),
      s({ type: "banner", title: "Bespoke service", text: "Book a private consultation with our designers.", button_text: "Contact us", button_link: "/products", tone: "dark" }),
      s({ type: "image_text", title: "Our craft", text: "Each piece is finished by hand and certified for purity.", image: img("luxe-craft", 900, 900), image_side: "right" }),
    ],
  },
  {
    id: "playful",
    name: "Little Ones",
    description: "Playful, colourful store for kids & toys.",
    preview: ["#e0f2fe", "#f97316"],
    theme: "modern",
    primary_color: "#f97316",
    font: "sans",
    announcement: "🎈 Birthday gifts delivered tomorrow!",
    sections: () => [
      s({ type: "hero", style: "split", title: "Toys that spark joy", subtitle: "Safe, fun and educational — for every age.", image: img("toys-hero", 1000, 1000), button_text: "Shop toys", button_link: "/products" }),
      s({ type: "categories", title: "Shop by age" }),
      s({ type: "products", title: "Most loved", source: "featured", limit: 8 }),
      perks([["🧸", "Child-safe", "Certified materials"], ["🎁", "Gift wrapping", "Free on request"], ["🚚", "Quick delivery", "Across Nepal"]]),
      s({ type: "faq", title: "Parents ask", items: [{ q: "Are the toys safe?", a: "Yes, all toys meet safety standards for their age group." }] }),
    ],
  },
];

export function getTemplate(id: string) {
  return TEMPLATES.find((t) => t.id === id);
}

