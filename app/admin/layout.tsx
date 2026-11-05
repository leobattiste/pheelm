import type { Metadata } from "next";
import AdminNav from "./AdminNav";
import { requireAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";
// Adding and importing films in batches can take a while; give admin actions room to finish.
export const maxDuration = 60;
export const metadata: Metadata = { title: "Admin", robots: { index: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <div className="admin">
      <AdminNav />
      {children}
    </div>
  );
}
