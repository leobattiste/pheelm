import { publicPageMetadata } from "@/lib/seo";
import type { Metadata } from "next";
import Tabs from "@/components/Tabs";
import { PrivacyPolicy, TermsPolicy, CopyrightPolicy, CommunityGuidelines } from "./Policies";

export const metadata: Metadata = publicPageMetadata("/legal");
export default function LegalPage() {
  return <article className="page full-width info-page legal-page">
    <header className="page-head"><h1>Legal</h1><p className="lead">Information about your privacy, rights, and responsibilities when using Pheelm.</p></header>
    <Tabs tabs={[
      { id: "privacy", label: "Privacy", panel: <PrivacyPolicy /> },
      { id: "terms", label: "Terms", panel: <TermsPolicy /> },
      { id: "copyright", label: "Copyright", panel: <CopyrightPolicy /> },
      { id: "community-guidelines", label: "Community Guidelines", panel: <CommunityGuidelines /> },
    ]} />
  </article>;
}
