"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { feedbackHref } from "@/lib/feedback";
import Icon from "./Icon";

/**
 * "Give feedback", tied to what it's about. Pass `about` and `label` for a specific film, person,
 * collection or part of a page; without them it uses the page you're on and its title.
 */
export default function FeedbackLink({ about, label, className = "button ghost", children, onNavigate }: {
  about?: string; label?: string; className?: string; children?: ReactNode; onNavigate?: () => void;
}) {
  const router = useRouter();
  const fixed = about && label ? feedbackHref(about, label) : null;
  return (
    <Link
      className={className}
      href={fixed ?? "/contact?topic=feedback"}
      onClick={(e) => {
        onNavigate?.();
        if (fixed) return;
        // The page you're on, read when pressed, so it's right after client-side navigation.
        if (location.pathname.startsWith("/contact")) return;
        e.preventDefault();
        const title = document.title.replace(/\s*[|•–-]\s*Pheelm\s*$/i, "").trim() || "This page";
        router.push(feedbackHref(location.pathname + location.search, title));
      }}
    >
      {children ?? <><Icon name="comment" />Give feedback</>}
    </Link>
  );
}
