import { privateMetadata } from "@/lib/seo";
import type { Metadata } from "next";
import Link from "next/link";
import AdminNav from "./AdminNav";
import "./admin.css";
import { requireAdmin } from "@/lib/admin";
import { adminCounts } from "@/lib/admin-counts";

export const dynamic = "force-dynamic";
// Adding and importing films in batches can take a while; give admin actions room to finish.
export const maxDuration = 60;
export const metadata: Metadata = privateMetadata("Admin");

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { db, user, owner } = await requireAdmin();
  const counts = await adminCounts(db);
  return (
    <section className="page account-page admin">
      <header className="page-head">
        <h1>Admin</h1>
        <p className="label admin-who">
          <span>{user.email}</span>
          <span className="status-pill tone-neutral">{owner ? "Owner" : "Admin"}</span>
          <Link href="/">View site</Link>
          <Link href="/account">Your account</Link>
        </p>
      </header>
      <AdminNav counts={counts} />
      <div className="tab-panel admin-content">{children}</div>
    </section>
  );
}
