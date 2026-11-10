import { publicPageMetadata } from "@/lib/seo";
import type { Metadata } from "next";
import HelpBrowser from "./HelpBrowser";
import "./help.css";

export const metadata: Metadata = publicPageMetadata("/help");

export default function HelpPage() {
  return (
    <article className="page full-width info-page legal-page help-page">
      <header className="page-head">
        <h1>Help</h1>
        <p className="lead">Find answers, explore features and learn how to use Pheelm.</p>
      </header>
      <HelpBrowser />
    </article>
  );
}
