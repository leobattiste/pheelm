import { publicPageMetadata } from "@/lib/seo";
import type { Metadata } from "next";
import Link from "next/link";
import SharePheelmButton from "@/components/SharePheelmButton";

export const metadata: Metadata = publicPageMetadata("/about");

export default function AboutPage() {
  return (
    <article className="page full-width info-page about-page">
      <div className="prose">
        <h2>What Is Pheelm?</h2>
        <p>
          Pheelm is a platform dedicated to discovering films by Black directors from around the world.
          It brings together films, filmmakers, and film enthusiasts in one place, where people can
          explore cinema, learn about the directors behind their favorite films, create and share
          watchlists, and connect with others.
        </p>

        <h2>Why We Started</h2>
        <p>
          Black filmmakers have made significant contributions to cinema, yet many continue to face
          limited opportunities, recognition, and visibility compared to their counterparts. We started
          Pheelm to help address this gap by creating a dedicated space where their work can be
          discovered, appreciated, and celebrated.
        </p>

        <h2>What We Want to Achieve</h2>
        <p>
          Our goal is to make films by Black directors easier to discover and introduce their work to
          wider audiences. We want to build a lasting platform that celebrates Black filmmaking across
          generations and borders while bringing together a community of people who share a love for cinema.
        </p>

        <h2>How You Can Contribute</h2>
        <p>Pheelm is an independent platform that grows with the support of its community. Here are a few ways you can help:</p>

        <h3>Suggest a Film or Director</h3>
        <p>
          Know a film or director we haven&apos;t featured yet? We&apos;d love to hear from you.
          Your suggestions help us expand our collection and introduce more people to filmmakers whose
          work deserves attention. <Link href="/submit">Suggest a film</Link> or{" "}
          <Link href="/contact">tell us about a director</Link>.
        </p>

        <h3>Share Pheelm</h3>
        <p>
          Help us reach more film lovers by <SharePheelmButton /> with your friends, family, and
          communities. Every share helps more people discover films and the directors behind them.
        </p>

        <h3>Support Us With a Donation</h3>
        <p>
          We don&apos;t run ads. You can <Link href="/donate">make a donation</Link> to help cover
          operating costs, improve the platform, and keep Pheelm accessible to everyone.
        </p>
      </div>
    </article>
  );
}
