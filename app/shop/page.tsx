import Link from "next/link";
import type { Metadata } from "next";
import ProductArt from "@/components/ProductArt";
import { publicPageMetadata } from "@/lib/seo";
import { fromPrice, getProducts, money, soldOut } from "@/lib/shop";

export const revalidate = 3600;
export const metadata: Metadata = publicPageMetadata("/shop");

export default async function ShopPage() {
  const products = await getProducts();
  return (
    <section className="page">
      <header className="page-head intro-head">
        <h1>Shop</h1>
        <p className="lead">Pheelm merch, printed to order. Every purchase helps keep Pheelm free.</p>
      </header>
      {products.length ? (
        <ul className="product-grid">
          {products.map((p, i) => {
            const many = new Set(p.variants.map((v) => v.price)).size > 1;
            return (
              <li key={p.handle} className="product-card">
                <Link href={`/shop/${p.handle}`}>
                  <ProductArt product={p} priority={i < 4} />
                  <span className="product-card-title">{p.title}</span>
                  <span className="product-card-meta">
                    {soldOut(p) ? "Sold out" : `${many ? "From " : ""}${money(fromPrice(p), p.currency)}`}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="empty-state"><p>Nothing in the shop yet</p><p className="muted">New merch is on its way.</p></div>
      )}
    </section>
  );
}
