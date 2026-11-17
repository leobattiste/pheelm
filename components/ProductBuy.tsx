"use client";

import { useMemo, useState } from "react";
import { money, type ShopProduct } from "@/lib/shop";

/** Price, option choices (colour, size) and the Buy button for one product. */
export default function ProductBuy({ product }: { product: ShopProduct }) {
  const first = product.variants.find((v) => v.available) ?? product.variants[0];
  const [chosen, setChosen] = useState<Record<string, string>>(first.options);
  const variant = useMemo(
    () => product.variants.find((v) => product.options.every((o) => v.options[o.name] === chosen[o.name])),
    [product, chosen],
  );
  // A value is crossed out when no variant with the other current choices has it in stock.
  const inStock = (name: string, value: string) =>
    product.variants.some((v) => v.available && v.options[name] === value && product.options.every((o) => o.name === name || v.options[o.name] === chosen[o.name]));
  const available = !!variant?.available;
  return (
    <div className="product-buy">
      <p className="product-price">{money(variant?.price ?? first.price, product.currency)}</p>
      {product.options.map((o) => (
        <fieldset key={o.name} className="product-option">
          <legend>{o.name}<span className="muted">{chosen[o.name]}</span></legend>
          <div className="chip-row filter-choices">
            {o.values.map((value) => (
              <button key={value} type="button" className={`button ghost${inStock(o.name, value) ? "" : " is-unavailable"}`}
                aria-pressed={chosen[o.name] === value} onClick={() => setChosen((c) => ({ ...c, [o.name]: value }))}>
                {value}
              </button>
            ))}
          </div>
        </fieldset>
      ))}
      {product.checkoutUrl && available ? (
        <a className="button primary product-cta" href={product.checkoutUrl}>Buy now</a>
      ) : (
        <button type="button" className="button primary product-cta" disabled>
          {available ? "Coming soon" : "Sold out"}
        </button>
      )}
    </div>
  );
}
