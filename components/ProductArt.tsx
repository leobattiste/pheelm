import Image from "next/image";
import type { ShopProduct } from "@/lib/shop";

/** A product photo, or (until the store has photos) a card with the product's name. */
export default function ProductArt({ product, index = 0, priority, sizes }: { product: ShopProduct; index?: number; priority?: boolean; sizes?: string }) {
  const img = product.images[index];
  return (
    <span className="product-art">
      {img ? (
        <Image src={img.url} alt={img.alt} fill sizes={sizes ?? "(min-width: 900px) 25vw, 50vw"} priority={priority} />
      ) : (
        <span className="product-art-card" aria-hidden="true">
          <span className="product-art-kind">{product.kind}</span>
          <span className="product-art-mark">pheelm</span>
        </span>
      )}
    </span>
  );
}
