import { HeadSkeleton, Loading, TextSkeleton } from "@/components/Skeletons";
export default function LoadingAccount() { return <Loading label="Page" className="page narrow"><HeadSkeleton lead={false} /><TextSkeleton lines={10} /></Loading>; }
