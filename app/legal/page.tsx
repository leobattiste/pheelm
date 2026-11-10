import { publicPageMetadata } from "@/lib/seo";
import type { Metadata } from "next";
import Tabs from "@/components/Tabs";
import { LEGAL_UPDATED } from "@/lib/site";
import { PrivacyPolicy, TermsPolicy, CopyrightPolicy, CommunityGuidelines } from "./Policies";

export const metadata: Metadata = publicPageMetadata("/legal");
export default function LegalPage() {
  return <article className="page full-width info-page legal-page">
    <header className="page-head"><h1>Legal</h1><p className="lead">Privacy, rights and the rules for using Pheelm. Effective {LEGAL_UPDATED}.</p></header>
    <Tabs tabs={[
      { id: "privacy", label: "Privacy", panel: <PrivacyPolicy /> },
      { id: "copyright", label: "Copyright", panel: <CopyrightPolicy /> },
      { id: "terms", label: "Terms", panel: <TermsPolicy /> },
      { id: "community-guidelines", label: "Community", panel: <CommunityGuidelines /> },
    ]} />
  </article>;
}
