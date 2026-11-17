/**
 * The Pheelm shop. For now the products below are samples so the pages can be designed and tested.
 * When the Shopify store is connected, getProducts and getProduct will read from the Shopify
 * Storefront API instead; the pages won't need to change.
 */
export type ShopVariant = { id: string; options: Record<string, string>; price: number; available: boolean };
export type ShopProduct = {
  handle: string;
  title: string;
  kind: string;
  description: string;
  details: string[];
  currency: string;
  images: { url: string; alt: string }[];
  options: { name: string; values: string[] }[];
  variants: ShopVariant[];
  /** Shopify checkout or product URL; empty until the store is connected. */
  checkoutUrl?: string;
};

const SIZES = ["S", "M", "L", "XL", "2XL"];
function variants(prefix: string, colors: string[], sizes: string[] | null, price: number, soldOut: string[] = []): ShopVariant[] {
  const out: ShopVariant[] = [];
  for (const color of colors) for (const size of sizes ?? [""]) {
    const options: Record<string, string> = { Colour: color };
    if (size) options.Size = size;
    const id = `${prefix}-${color}-${size}`.toLowerCase().replace(/\s+/g, "-");
    out.push({ id, options, price, available: !soldOut.includes(`${color} ${size}`.trim()) });
  }
  return out;
}

const SAMPLE: ShopProduct[] = [
  {
    handle: "pheelm-wordmark-tee", title: "Pheelm wordmark tee", kind: "T-shirt", currency: "USD", images: [],
    description: "A heavyweight cotton tee with the Pheelm wordmark across the chest. Printed to order, so nothing goes to waste.",
    details: ["100% organic cotton, 220 gsm", "Relaxed fit; size down for a closer fit", "Printed and shipped to order in 3 to 7 working days"],
    options: [{ name: "Colour", values: ["Black", "White"] }, { name: "Size", values: SIZES }],
    variants: variants("tee", ["Black", "White"], SIZES, 32, ["White 2XL"]),
  },
  {
    handle: "for-the-love-of-cinema-hoodie", title: "For the love of cinema hoodie", kind: "Hoodie", currency: "USD", images: [],
    description: "A brushed-fleece hoodie with “For the love of cinema” embroidered small on the chest.",
    details: ["80% cotton, 20% recycled polyester", "Embroidered, not printed", "Printed and shipped to order in 3 to 7 working days"],
    options: [{ name: "Colour", values: ["Black", "Stone"] }, { name: "Size", values: SIZES }],
    variants: variants("hoodie", ["Black", "Stone"], SIZES, 64),
  },
  {
    handle: "pheelm-tote", title: "Pheelm tote", kind: "Tote bag", currency: "USD", images: [],
    description: "A sturdy canvas tote, big enough for a laptop and a stack of DVDs.",
    details: ["Heavy cotton canvas", "38 × 42 cm, long handles", "Printed and shipped to order in 3 to 7 working days"],
    options: [{ name: "Colour", values: ["Natural", "Black"] }],
    variants: variants("tote", ["Natural", "Black"], null, 24),
  },
  {
    handle: "black-cinema-poster", title: "Black cinema poster", kind: "Poster", currency: "USD", images: [],
    description: "A typographic poster listing a century of films by Black directors, from 1920 to today.",
    details: ["Matte, museum-grade paper", "Unframed", "Printed and shipped to order in 3 to 7 working days"],
    options: [{ name: "Size", values: ["30 × 40 cm", "50 × 70 cm"] }],
    variants: [
      { id: "poster-30x40", options: { Size: "30 × 40 cm" }, price: 28, available: true },
      { id: "poster-50x70", options: { Size: "50 × 70 cm" }, price: 42, available: true },
    ],
  },
  {
    handle: "pheelm-cap", title: "Pheelm cap", kind: "Cap", currency: "USD", images: [],
    description: "A six-panel cotton cap with a small embroidered Pheelm wordmark.",
    details: ["Cotton twill, adjustable strap", "One size", "Printed and shipped to order in 3 to 7 working days"],
    options: [{ name: "Colour", values: ["Black", "Navy"] }],
    variants: variants("cap", ["Black", "Navy"], null, 26, ["Navy"]),
  },
];

export async function getProducts(): Promise<ShopProduct[]> {
  return SAMPLE;
}
export async function getProduct(handle: string): Promise<ShopProduct | null> {
  return SAMPLE.find((p) => p.handle === handle) ?? null;
}
export const fromPrice = (p: ShopProduct) => Math.min(...p.variants.map((v) => v.price));
export const soldOut = (p: ShopProduct) => p.variants.every((v) => !v.available);
export function money(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: amount % 1 ? 2 : 0 }).format(amount);
}
