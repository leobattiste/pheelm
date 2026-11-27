import { publicPageMetadata } from "@/lib/seo";
import type { Metadata } from "next";
import ContactForm from "@/components/ContactForm";

export const metadata: Metadata = publicPageMetadata("/partnerships");

export default function PartnershipsPage() {
  return (
    <article className="page full-width info-page partnerships-page">
      <div className="form-split">
        <div className="form-split-intro">
          <header className="page-head">
            <h1>Partnership</h1>
          </header>
          <div className="prose">
            <p>
              Pheelm is open to collaborating with filmmakers, film festivals, cultural organizations,
              educational institutions, and others who share our passion for cinema.
            </p>
            <p>
              Whether it&apos;s a film screening, an editorial collaboration, a community initiative,
              or another creative project, we&apos;d love to hear your ideas.
            </p>
            <p>
              Complete the form to tell us about your proposal. We&apos;ll review your inquiry and get in
              touch if there&apos;s an opportunity to work together.
            </p>
          </div>
        </div>
        <section className="info-section form-split-form" aria-label="Partnership proposal">
          <ContactForm partnership />
        </section>
      </div>
    </article>
  );
}
