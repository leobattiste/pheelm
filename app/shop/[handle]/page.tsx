import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import ProductArt from "@/components/ProductArt";
import ProductBuy from "@/components/ProductBuy";
import { pageMetadata } from "@/lib/seo";
import { getProduct, getProducts } from "@/lib/shop";

export const revalidate = 3600;

export async function generateStaticParams() {
  return (await getProducts()).map((p) => ({ handle: p.handle }));
}

export async function generateMetadata({ params }: { params: Promise<{ handle: string }> }): Promise<Metadata> {
  const p = await getProduct((await params).handle);
  return p ? pageMetadata(p.title, p.description, `/shop/${p.handle}`) : {};
}

export default async function ProductPage({ params }: { params: Promise<{ handle: string }> }) {
  const product = await getProduct((await params).handle);
  if (!product) notFound();
  const photos = product.images.length ? product.images.map((_, i) => i) : [0];
  return (
    <article className="page product-page">
      <div className="product-gallery" aria-label={`${product.title} photos`}>
        {photos.map((i) => <ProductArt key={i} product={product} index={i} priority={i === 0} sizes="(min-width: 900px) 50vw, 100vw" />)}
      </div>
      <div className="product-info">
        <Link href="/shop" className="product-back">Shop</Link>
        <h1 className="product-title">{product.title}</h1>
        <ProductBuy product={product} />
        <p className="product-description">{product.description}</p>
        <ul className="product-details">
          {product.details.map((d) => <li key={d}>{d}</li>)}
        </ul>
        <p className="muted product-note">Printed to order, so returns are accepted only for faulty or wrong items. <Link href="/contact">Contact us</Link> about an order.</p>
      </div>
    </article>
  );
}
