import { FilmGridSkeleton, Loading, ToolbarSkeleton } from "@/components/Skeletons";
export default function LoadingFilms() {
  return <Loading label="Films"><ToolbarSkeleton /><FilmGridSkeleton count={12} /></Loading>;
}
