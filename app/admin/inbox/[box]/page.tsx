import { notFound } from "next/navigation";
import { isBox } from "@/lib/inbox";
import InboxList from "../InboxList";

/** One box: Contact, Feedback, Partnerships, or Press and privacy. */
export default async function InboxBoxPage({ params, searchParams }: {
  params: Promise<{ box: string }>; searchParams: Promise<{ view?: string; q?: string; page?: string; deleted?: string }>;
}) {
  const { box } = await params;
  if (!isBox(box)) notFound();
  return <InboxList box={box} searchParams={searchParams} />;
}
