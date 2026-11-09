import type { Metadata } from "next";
import HelpBrowser from "./HelpBrowser";
import "./help.css";

export const metadata: Metadata = {
  title: "Help",
  description: "Find answers about films, collections, Watchlist, accounts, privacy and using Pheelm.",
  alternates: { canonical: "/help" },
};

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
