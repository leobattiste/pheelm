import { privateMetadata } from "@/lib/seo";
import type { Metadata } from "next";

export const metadata: Metadata = privateMetadata("Sign in");

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
