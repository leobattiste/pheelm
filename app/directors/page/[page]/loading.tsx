import { DirectorGridSkeleton, Loading, ToolbarSkeleton } from "@/components/Skeletons";
export default function LoadingDirectors() {
  return <Loading label="Directors"><ToolbarSkeleton /><DirectorGridSkeleton count={6} /></Loading>;
}
