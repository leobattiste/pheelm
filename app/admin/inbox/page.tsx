import InboxList from "./InboxList";

/** Every message, whichever box it's in. */
export default function AdminInbox({ searchParams }: { searchParams: Promise<{ view?: string; q?: string; page?: string; deleted?: string }> }) {
  return <InboxList searchParams={searchParams} />;
}
