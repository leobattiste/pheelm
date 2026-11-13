import { privateMetadata } from "@/lib/seo";
import type { Metadata } from "next";
import AdminSidebar from "./AdminNav";
import "./admin.css";
import { requireAdmin } from "@/lib/admin";
import { adminCounts } from "@/lib/admin-counts";

export const dynamic = "force-dynamic";
// Adding and importing films in batches can take a while; give admin actions room to finish.
export const maxDuration = 60;
export const metadata: Metadata = privateMetadata("Admin");

/** The admin is its own app: a sidebar of sections, then the page. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { db, user, owner } = await requireAdmin();
  const counts = await adminCounts(db);
  return (
    <div className="admin admin-app">
      <AdminSidebar counts={counts} who={user.email ?? ""} owner={owner} />
      <div className="admin-main admin-content">{children}</div>
    </div>
  );
}
