"use client";

import { useRouter } from "next/navigation";
import Icon from "@/components/Icon";

const SIZES = ["20", "40", "80", "all"] as const;

export default function AdminViewControls({ count, shown, size, noun, allowAll = true }: {
  count: number; shown: number; size: string; noun: string; allowAll?: boolean;
}) {
  const router = useRouter();
  return (
    <div className="admin-view-controls">
      <span className="muted">{shown.toLocaleString()} of {count.toLocaleString()} {noun}</span>
      <label className="admin-view-size">
        <span>Show</span>
        <select aria-label={`Number of ${noun} to view`} value={size} onChange={(e) => {
          const params = new URLSearchParams(window.location.search);
          const next = e.currentTarget.value;
          if (next === "40") params.delete("limit"); else params.set("limit", next);
          params.delete("page");
          params.delete("updated");
          params.delete("error");
          router.push(`${window.location.pathname}?${params.toString()}`, { scroll: false });
        }}>
          {SIZES.filter((s) => allowAll || s !== "all").map((s) => <option value={s} key={s}>{s === "all" ? "All" : s}</option>)}
        </select>
        <Icon name="filter" size={16} />
      </label>
    </div>
  );
}
