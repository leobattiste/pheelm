import { CollectionListSkeleton, Loading, ToolbarSkeleton } from "@/components/Skeletons";
export default function LoadingWatchlists() {
  return <Loading label="Watchlists"><ToolbarSkeleton /><CollectionListSkeleton count={6} /></Loading>;
}
