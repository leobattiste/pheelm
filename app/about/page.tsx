import { publicPageMetadata } from "@/lib/seo";
import type { Metadata } from "next";
import Link from "next/link";
import SharePheelmButton from "@/components/SharePheelmButton";

export const metadata: Metadata = publicPageMetadata("/about");

const ctaStyle = { display: "flex", flexWrap: "wrap", gap: "0.75rem" } as const;

export default function AboutPage() {
  return (
    <article className="page full-width info-page">
      <header className="page-head">
        <h1>About Pheelm</h1>
        <p className="lead">Discover films by Black directors from around the world.</p>
      </header>

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
        <p>Recommend films and filmmakers we haven&apos;t featured yet and help us expand the collection.</p>
        <div style={ctaStyle}>
          <Link className="button" href="/submit">Suggest a film</Link>
          <Link className="button" href="/contact">Suggest a director</Link>
        </div>

        <h3>Spread the Word</h3>
        <p>Share Pheelm with friends, family, and fellow film enthusiasts to help more people discover the platform.</p>
        <div style={ctaStyle}>
          <SharePheelmButton />
        </div>

        <h3>Make a Donation</h3>
        <p>
          We don&apos;t run ads. Your support helps cover operating costs, improve the platform,
          and keep Pheelm accessible to everyone.
        </p>
        <div style={ctaStyle}>
          <Link className="button" href="/donate">Donate to Pheelm</Link>
        </div>
      </div>
    </article>
  );
}
