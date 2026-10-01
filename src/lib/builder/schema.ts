import { z } from "zod";

/* Every block a seller can put on their homepage. Shared by the editor (client) and the storefront (server). */

const text = (max: number) => z.string().max(max).default("");
const url = z
  .string()
  .max(500)
  .default("")
  .refine((v) => v === "" || /^(https?:\/\/|\/)/.test(v), "Links must start with https:// or /");

const base = { id: z.string().min(1).max(40), hidden: z.boolean().default(false) };

export const heroSection = z.object({
  ...base,
  type: z.literal("hero"),
  style: z.enum(["overlay", "split", "centered", "gradient"]).default("overlay"),
  title: text(150),
  subtitle: text(300),
  image: url,
  button_text: text(40),
  button_link: url,
});

export const productsSection = z.object({
  ...base,
  type: z.literal("products"),
  title: text(100),
  source: z.enum(["featured", "newest", "sale", "category"]).default("newest"),
  category_id: text(36),
  limit: z.number().int().min(1).max(24).default(8),
  layout: z.enum(["grid", "carousel"]).default("grid"),
});

export const categoriesSection = z.object({ ...base, type: z.literal("categories"), title: text(100) });

export const bannerSection = z.object({
  ...base,
  type: z.literal("banner"),
  title: text(150),
  text: text(300),
  image: url,
  button_text: text(40),
  button_link: url,
  tone: z.enum(["brand", "dark", "light"]).default("brand"),
});

export const imageTextSection = z.object({
  ...base,
  type: z.literal("image_text"),
  title: text(150),
  text: text(2000),
  image: url,
  image_side: z.enum(["left", "right"]).default("left"),
  button_text: text(40),
  button_link: url,
});

export const textSection = z.object({
  ...base,
  type: z.literal("text"),
  title: text(150),
  text: text(5000),
  align: z.enum(["left", "center"]).default("center"),
});

export const perksSection = z.object({
  ...base,
  type: z.literal("perks"),
  items: z.array(z.object({ icon: text(8), title: text(60), text: text(120) })).max(6).default([]),
});

export const testimonialsSection = z.object({
  ...base,
  type: z.literal("testimonials"),
  title: text(100),
  items: z.array(z.object({ name: text(60), text: text(400), rating: z.number().int().min(1).max(5).default(5) })).max(9).default([]),
});

export const faqSection = z.object({
  ...base,
  type: z.literal("faq"),
  title: text(100),
  items: z.array(z.object({ q: text(200), a: text(1000) })).max(20).default([]),
});

export const videoSection = z.object({ ...base, type: z.literal("video"), title: text(100), url });

export const gallerySection = z.object({
  ...base,
  type: z.literal("gallery"),
  title: text(100),
  images: z.array(url).max(12).default([]),
});

export const countdownSection = z.object({
  ...base,
  type: z.literal("countdown"),
  title: text(100),
  text: text(200),
  ends_at: text(40),
  button_text: text(40),
  button_link: url,
});

export const htmlSection = z.object({ ...base, type: z.literal("html"), html: text(20000), height: z.number().int().min(50).max(2000).default(300) });

export const spacerSection = z.object({ ...base, type: z.literal("spacer"), size: z.enum(["sm", "md", "lg"]).default("md") });

export const section = z.discriminatedUnion("type", [
  heroSection,
  productsSection,
  categoriesSection,
  bannerSection,
  imageTextSection,
  textSection,
  perksSection,
  testimonialsSection,
  faqSection,
  videoSection,
  gallerySection,
  countdownSection,
  htmlSection,
  spacerSection,
]);

export const page = z.object({
  slug: z.string().regex(/^[a-z0-9-]{1,40}$/),
  title: z.string().min(1).max(80),
  body: z.string().max(20000).default(""),
  in_menu: z.boolean().default(true),
});

export const layoutSchema = z.object({
  sections: z.array(section).max(40),
  pages: z.array(page).max(15).default([]),
  custom_css: z.string().max(30000).default(""),
  template: z.string().max(40).default(""),
});

export type Section = z.infer<typeof section>;
export type SectionType = Section["type"];
export type StorePage = z.infer<typeof page>;
export type Layout = z.infer<typeof layoutSchema>;

export const SECTION_INFO: Record<SectionType, { label: string; icon: string; description: string }> = {
  hero: { label: "Hero banner", icon: "🖼️", description: "Big headline with image and button" },
  products: { label: "Product grid", icon: "🛍️", description: "Featured, newest, on-sale or a category" },
  categories: { label: "Shop by category", icon: "🗂️", description: "Category tiles with photos" },
  banner: { label: "Promo banner", icon: "📣", description: "Eye-catching strip for offers" },
  image_text: { label: "Image + text", icon: "🧩", description: "Tell your story next to a photo" },
  text: { label: "Text", icon: "📝", description: "Heading and paragraph" },
  perks: { label: "Perks bar", icon: "✅", description: "Free delivery, COD, easy returns…" },
  testimonials: { label: "Testimonials", icon: "⭐", description: "What customers say" },
  faq: { label: "FAQ", icon: "❓", description: "Questions and answers" },
  video: { label: "Video", icon: "🎬", description: "YouTube video" },
  gallery: { label: "Gallery", icon: "📸", description: "Photo grid / lookbook" },
  countdown: { label: "Sale countdown", icon: "⏳", description: "Timer for flash sales" },
  html: { label: "Custom code", icon: "💻", description: "Your own HTML/CSS/JS, safely sandboxed" },
  spacer: { label: "Spacer", icon: "↕️", description: "Breathing room" },
};

export const newId = () => Math.random().toString(36).slice(2, 10);

/** A fresh block with sensible starter content. */
export function blankSection(type: SectionType): Section {
  const id = newId();
  const s = (v: object) => section.parse({ id, type, ...v });
  switch (type) {
    case "hero":
      return s({ title: "Your headline here", subtitle: "Tell visitors what makes your store special.", button_text: "Shop now", button_link: "/products" });
    case "products":
      return s({ title: "New arrivals", source: "newest" });
    case "categories":
      return s({ title: "Shop by category" });
    case "banner":
      return s({ title: "Big sale this weekend", text: "Up to 30% off selected items", button_text: "Shop the sale", button_link: "/products" });
    case "image_text":
      return s({ title: "Our story", text: "Share how your brand started and what you care about." });
    case "text":
      return s({ title: "Welcome", text: "Write anything you like here." });
    case "perks":
      return s({
        items: [
          { icon: "🚚", title: "Fast delivery", text: "All over Nepal" },
          { icon: "💵", title: "Cash on delivery", text: "Pay when it arrives" },
          { icon: "↩️", title: "Easy returns", text: "7-day exchange" },
        ],
      });
    case "testimonials":
      return s({ title: "Happy customers", items: [{ name: "Sita", text: "Loved the quality and fast delivery!", rating: 5 }] });
    case "faq":
      return s({ title: "Frequently asked questions", items: [{ q: "How long does delivery take?", a: "1–2 days inside the valley, 3–5 days outside." }] });
    case "video":
      return s({ title: "", url: "" });
    case "gallery":
      return s({ title: "Lookbook", images: [] });
    case "countdown":
      return s({
        title: "Flash sale ends in",
        text: "Don't miss out!",
        ends_at: new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 16),
        button_text: "Shop now",
        button_link: "/products",
      });
    case "html":
      return s({ html: "<div style=\"padding:24px;text-align:center;font-family:sans-serif\">\n  <h2>Hello from custom code 👋</h2>\n</div>", height: 200 });
    case "spacer":
      return s({});
  }
}

/** The homepage stores had before the builder existed, built from their old design settings. */
export function defaultLayout(store: { hero_title: string; hero_subtitle: string; hero_image_url: string; about: string; name: string; show_featured: boolean; show_categories: boolean; show_about: boolean; theme: string }): Layout {
  const sections: Section[] = [
    section.parse({ id: "hero", type: "hero", style: store.theme === "modern" ? "split" : store.theme === "minimal" ? "centered" : "overlay", title: store.hero_title || store.name, subtitle: store.hero_subtitle, image: store.hero_image_url, button_text: "Shop now", button_link: "/products" }),
  ];
  if (store.show_featured) sections.push(section.parse({ id: "featured", type: "products", title: "Featured", source: "featured" }));
  if (store.show_categories) sections.push(section.parse({ id: "cats", type: "categories", title: "Shop by category" }));
  sections.push(section.parse({ id: "new", type: "products", title: "New arrivals", source: "newest", limit: 12 }));
  if (store.show_about && store.about) sections.push(section.parse({ id: "about", type: "text", title: `About ${store.name}`, text: store.about }));
  return { sections, pages: [], custom_css: "", template: "" };
}

export function parseLayout(raw: string | undefined | null, store: Parameters<typeof defaultLayout>[0]): Layout {
  if (!raw) return defaultLayout(store);
  try {
    const parsed = layoutSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : defaultLayout(store);
  } catch {
    return defaultLayout(store);
  }
}
