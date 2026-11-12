/** How the admin inbox sorts and labels messages. Shared by the inbox screens and their actions. */

export type InboxBox = "contact" | "feedback" | "partnerships" | "press";
export type MessageStatus = "new" | "open" | "done" | "spam";
export type PartnershipStage = "new" | "talking" | "accepted" | "declined";

/** Each box collects some of the topics people choose on the contact and partnership forms. */
export const BOXES: { id: InboxBox; label: string; topics: string[]; about: string }[] = [
  { id: "contact", label: "Contact", topics: ["general"], about: "Questions and ideas from the contact form." },
  { id: "feedback", label: "Feedback", topics: ["feedback", "correction"], about: "Feedback and corrections, usually about a page on Pheelm." },
  { id: "partnerships", label: "Partnerships", topics: ["partnership"], about: "Requests to work with Pheelm, from the partnership form." },
  { id: "press", label: "Press and privacy", topics: ["press", "privacy"], about: "Press questions, and privacy requests, which have a 30-day deadline." },
];

export const TOPIC_LABEL: Record<string, string> = {
  general: "Question or idea", feedback: "Feedback", correction: "Correction",
  partnership: "Partnership", press: "Press", privacy: "Privacy request",
};

export const STATUS_LABEL: Record<MessageStatus, string> = { new: "New", open: "Read", done: "Done", spam: "Spam" };

export const STAGES: { id: PartnershipStage; label: string }[] = [
  { id: "new", label: "New" },
  { id: "talking", label: "In conversation" },
  { id: "accepted", label: "Accepted" },
  { id: "declined", label: "Declined" },
];

export function boxOf(topic: string): InboxBox {
  return BOXES.find((b) => b.topics.includes(topic))?.id ?? "contact";
}

export function isBox(value: string | undefined): value is InboxBox {
  return BOXES.some((b) => b.id === value);
}

/** Starting points for replies. The text is editable before it's sent. */
export const REPLY_TEMPLATES: { id: string; label: string; topics: string[]; text: (name: string) => string }[] = [
  { id: "thanks", label: "Thanks for writing", topics: ["general", "feedback", "press"],
    text: (n) => `Hi ${n},\n\nThanks for writing to Pheelm. \n\nBest,\nPheelm` },
  { id: "fixed", label: "Correction made", topics: ["correction", "feedback"],
    text: (n) => `Hi ${n},\n\nThank you for pointing this out. We've corrected it on Pheelm.\n\nBest,\nPheelm` },
  { id: "talk", label: "Interested, let's talk", topics: ["partnership"],
    text: (n) => `Hi ${n},\n\nThank you for reaching out about working with Pheelm. We'd like to learn more. Could you share a few times that work for a short call?\n\nBest,\nPheelm` },
  { id: "decline", label: "Not a fit right now", topics: ["partnership"],
    text: (n) => `Hi ${n},\n\nThank you for thinking of Pheelm. It isn't the right fit for us at the moment, but we appreciate you reaching out and wish you the best with the project.\n\nBest,\nPheelm` },
  { id: "privacy-received", label: "Privacy request received", topics: ["privacy"],
    text: (n) => `Hi ${n},\n\nWe've received your privacy request and will complete it within 30 days. We may ask you to confirm it's you before we do.\n\nBest,\nPheelm` },
  { id: "privacy-done", label: "Privacy request completed", topics: ["privacy"],
    text: (n) => `Hi ${n},\n\nYour privacy request is complete. Reply to this email if anything looks wrong.\n\nBest,\nPheelm` },
];
