import type { Metadata } from "next";
import ContactForm from "@/components/ContactForm";

export const metadata: Metadata = {
  title: "Partnerships",
  description: "Partner with Pheelm on screenings, editorial collaborations, educational projects and community initiatives celebrating films by Black directors.",
  alternates: { canonical: "/partnerships" },
};
export default function PartnershipsPage() {
  return <article className="page full-width info-page">
    <header className="page-head"><h1>Partnerships</h1><p className="lead">Partner With Pheelm</p></header>
    <div className="prose">
      <p>Pheelm is an independent platform dedicated to helping people discover films by Black directors from around the world.</p>
      <p>We’re open to collaborating with filmmakers, film festivals, cultural organizations, educational institutions, and other individuals or organizations that share our passion for cinema.</p>
      <p>Whether it’s a screening, editorial collaboration, community initiative, or another creative project, we’d love to hear your ideas.</p>
      <h2>Let’s Work Together</h2>
      <p>Interested in partnering with us? Complete the form below to tell us about your proposal. We’ll review your inquiry and reach out if there’s an opportunity to collaborate.</p>
    </div>
    <section className="info-section" aria-labelledby="partner-form"><h2 id="partner-form">Partnership Inquiry Form</h2><ContactForm partnership /></section>
  </article>;
}
