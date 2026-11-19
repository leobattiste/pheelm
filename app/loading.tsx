import { FilmGridSkeleton, HeadSkeleton, Loading } from "@/components/Skeletons";
export default function LoadingPage() {
  return <Loading label="Page"><HeadSkeleton /><FilmGridSkeleton count={8} /></Loading>;
}
