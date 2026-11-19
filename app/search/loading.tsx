import { Loading, RowSkeleton, ToolbarSkeleton } from "@/components/Skeletons";
export default function LoadingSearch() {
  return <Loading label="Search" className="page unified-search-page"><ToolbarSkeleton filter={false} /><div className="search-discovery"><RowSkeleton /><RowSkeleton /><RowSkeleton kind="director" count={3} /></div></Loading>;
}
