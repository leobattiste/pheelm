import { Line, Loading, TextSkeleton } from "@/components/Skeletons";
export default function LoadingProduct() {
  return <Loading label="Product" className="page product-page"><div className="product-gallery" aria-hidden="true"><span className="product-art profile-skeleton-block" /></div><div className="product-info" aria-hidden="true"><span className="profile-skeleton-block skeleton-title" /><Line short /><TextSkeleton lines={5} /></div></Loading>;
}
