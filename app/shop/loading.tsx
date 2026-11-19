import { HeadSkeleton, Loading } from "@/components/Skeletons";
export default function LoadingShop() {
  return <Loading label="Shop"><HeadSkeleton /><ul className="product-grid" aria-hidden="true">{[0,1,2,3,4,5].map(i=><li key={i} className="product-card"><span className="product-art profile-skeleton-block" /><span className="profile-skeleton-block skeleton-line" /><span className="profile-skeleton-block skeleton-line is-short" /></li>)}</ul></Loading>;
}
