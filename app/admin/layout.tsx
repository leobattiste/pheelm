import type { Metadata } from "next";
import Link from "next/link";
import AdminNav from "./AdminNav";
import { requireAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";
// Adding and importing films in batches can take a while; give admin actions room to finish.
export const maxDuration = 60;
export const metadata: Metadata = { title: "Admin", robots: { index: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireAdmin();
  return (
    <section className="page account-page admin">
      <header className="page-head">
        <h1>Admin</h1>
        <p className="label">{user.email} • <Link href="/">View site</Link> • <Link href="/account">Your account</Link></p>
      </header>
      <AdminNav />
      <div className="tab-panel admin-content">{children}</div>
    </section>
  );
}
