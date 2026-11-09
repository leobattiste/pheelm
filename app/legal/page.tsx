import type { Metadata } from "next";
import Link from "next/link";
import Tabs from "@/components/Tabs";
import { LEGAL_UPDATED, SITE_NAME } from "@/lib/site";
import { PrivacyPolicy, TermsPolicy } from "./Policies";

export const metadata: Metadata = {
  title: "Legal",
  description: "Privacy, copyright, terms and community guidelines for Pheelm.",
  alternates: { canonical: "/legal" },
};

export default function LegalPage() {
  return (
    <article className="page full-width info-page legal-page">
      <header className="page-head">
        <h1>Legal</h1>
        <p className="lead">Privacy, rights and the rules for using {SITE_NAME}. Updated {LEGAL_UPDATED}.</p>
      </header>
      <Tabs tabs={[
        { id: "privacy", label: "Privacy", icon: "lock", panel: <PrivacyPolicy /> },
        { id: "copyright", label: "Copyright", icon: "tag", panel: <CopyrightPolicy /> },
        { id: "terms", label: "Terms", icon: "flag", panel: <TermsPolicy /> },
        { id: "community-guidelines", label: "Community guidelines", icon: "users", panel: <CommunityGuidelines /> },
      ]} />
    </article>
  );
}

function CopyrightPolicy() {
  return (
    <div className="prose">
      <h2>Copyright and credits</h2>
      <p>&copy; {new Date().getFullYear()} {SITE_NAME}. A project by Leo Battiste with the courtesy of TMDB.</p>
      <h2>Films and images</h2>
      <p>Films, posters, stills, portraits, trailers and platform logos belong to their respective rights holders. Their appearance on {SITE_NAME} does not transfer ownership or give visitors permission to reproduce or distribute them.</p>
      <h2>Film information and viewing links</h2>
      <p>Some film information and images are provided by <a href="https://www.themoviedb.org/" target="_blank" rel="noopener noreferrer">TMDB</a>. This product uses the TMDB API but is not endorsed or certified by TMDB. Viewing availability may include data supplied through TMDB by JustWatch and can change by region and date.</p>
      <h2>Your contributions</h2>
      <p>You retain ownership of original text and other material you contribute. Share only content you own or have permission to use. By publishing a contribution, you allow {SITE_NAME} to display it as part of the service, as explained in our terms.</p>
      <h2>Report a rights concern</h2>
      <p>If you believe material on {SITE_NAME} infringes your rights, <Link href="/contact?topic=general">contact us</Link>. Include the page URL, identify the material and the rights you hold or represent, and provide a way for us to reach you. We will review the request and may remove or restrict the material while investigating.</p>
      <p>For factual errors rather than rights concerns, use the <Link href="/contact?topic=correction">corrections form</Link>.</p>
    </div>
  );
}

function CommunityGuidelines() {
  return (
    <div className="prose">
      <h2>A place to discover and discuss cinema</h2>
      <p>{SITE_NAME} is a community for discovering films by Black directors. Discuss films and ideas thoughtfully, respect other members and help keep information accurate.</p>
      <h2>Respect people</h2>
      <p>No harassment, threats, hate speech, discrimination, impersonation or sharing another person&rsquo;s private information. Disagree with an opinion without attacking the person behind it.</p>
      <h2>Share responsibly</h2>
      <p>Keep collections, comments, profile content and submissions relevant and lawful. Do not post spam, scams, malicious links, pirated material or content you do not have permission to share. Mark significant spoilers clearly before discussing them.</p>
      <h2>Help keep the directory accurate</h2>
      <p>Check names, credits and release information before suggesting a change. Use <Link href="/submit">Suggest a film</Link> for additions and <Link href="/contact?topic=correction">contact us</Link> for corrections. Suggestions are reviewed before publication.</p>
      <h2>Use reports and blocking</h2>
      <p>Use the report action on a comment or collection to flag a concern. You can block a member from their profile and manage blocked members in Settings. For urgent safety concerns or issues without a report action, <Link href="/contact">contact us</Link>.</p>
      <h2>How we moderate</h2>
      <p>We review reports in context and may remove content, restrict features or suspend accounts that break these guidelines or our terms. Serious or repeated abuse can result in account removal. If you believe a moderation decision was mistaken, contact us with the relevant page or account details so we can review it.</p>
    </div>
  );
}
