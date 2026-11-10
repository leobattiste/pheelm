import { publicPageMetadata } from "@/lib/seo";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = publicPageMetadata("/about");

export default function AboutPage() {
  return <article className="page full-width info-page">
    <header className="page-head"><h1>About Pheelm</h1><p className="lead">Pheelm is an independent platform dedicated to discovering and celebrating films directed by Black filmmakers from around the world.</p></header>
    <div className="prose">
      <p>From early cinema to contemporary releases, we bring together films across different countries, genres, and generations. Our goal is to make it easier for anyone to discover great films, explore the work of Black directors, and experience stories they might otherwise miss.</p>
      <h2>Why We Exist</h2>
      <p>Black directors have made significant contributions to cinema, shaping the industry and bringing important stories and perspectives to the screen. Yet, many of their films remain overlooked, underrepresented, or difficult to discover.</p>
      <p>We created Pheelm because we believe these films deserve greater visibility and recognition.</p>
      <p>Black cinema extends far beyond any single country, culture, or genre. From influential classics to independent productions, there is a rich history of filmmaking that deserves to be explored and appreciated.</p>
      <p>Pheelm exists to help more people discover that history and the filmmakers who continue to shape it.</p>
      <h2>Our Mission</h2>
      <p>Our mission is simple: to make films by Black directors easier to discover, explore, and appreciate.</p>
      <p>We aim to build a growing, accessible platform that highlights Black filmmakers from across the world, regardless of their level of recognition, where they come from, or when their films were made.</p>
      <p>We believe that discovering films should be simple, that great work deserves recognition, and that cinema has the power to connect people through different stories and perspectives.</p>
      <h2>How You Can Contribute</h2>
      <p>Pheelm is an independent project, and the support of our community helps us continue to grow. There are several ways you can make a difference.</p>
      <h3>Suggest a Film or Director</h3>
      <p>Know a film or director we haven’t featured yet? We’d love to hear from you. Your suggestions help us expand our collection and introduce more people to filmmakers whose work deserves attention.</p>
      <p><Link href="/submit">Suggest a film</Link> or <Link href="/contact">tell us about a director</Link>.</p>
      <h3>Share Pheelm</h3>
      <p>Help us reach more film lovers by sharing Pheelm with your friends, family, and communities. Every share helps more people discover films and the directors behind them.</p>
      <h3>Support Us With a Donation</h3>
      <p>Pheelm is independently built and operated. We don’t run advertisements, and we want to keep the platform accessible to everyone.</p>
      <p>Your donations help cover the costs of maintaining, improving, and expanding Pheelm. Every contribution, no matter the amount, helps us continue our work while remaining independent.</p>
      <p><Link href="/donate">Support Pheelm</Link>.</p>
      <h2>Thank You</h2>
      <p>Whether you’re discovering your first film, suggesting a director, sharing our platform, or supporting us financially, you’re helping Pheelm grow.</p>
      <p>We’re grateful to everyone who believes in what we’re building and helps us make more films by Black directors easier to discover.</p>
      <p>Made for the love of cinema.</p>
    </div>
  </article>;
}
