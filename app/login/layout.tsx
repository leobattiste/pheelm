import type { Metadata } from "next";
import { PAGE_COPY } from "@/lib/site";

export const metadata: Metadata = { title: "Sign in", description: PAGE_COPY.signIn, robots: { index: false } };

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
