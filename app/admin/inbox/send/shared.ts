// Shared by the Send page, its form and its server actions.

export type Kind = "announcement" | "service" | "newsletter";
export type Audience = "members" | "followers" | "watchlisted" | "member" | "subscribers";
export type Channel = "in_app" | "email";

export const KINDS: { id: Kind; label: string; about: string }[] = [
  { id: "announcement", label: "Announcement", about: "News for members. Members who turned announcements off don't get it." },
  { id: "service", label: "Service notice", about: "Only for changes that affect members' accounts, like new terms. Sent even if optional emails are off." },
  { id: "newsletter", label: "Newsletter", about: "Email to people who confirmed a newsletter subscription. Members who didn't subscribe don't get it." },
];

export const AUDIENCES: { id: Exclude<Audience, "subscribers">; label: string }[] = [
  { id: "members", label: "All members" },
  { id: "followers", label: "Followers of a director" },
  { id: "watchlisted", label: "Members with a film in their watchlist" },
  { id: "member", label: "One member" },
];

export type Draft = { kind: Kind; audience: Audience; ref: string | null; channels: Channel[]; subject: string; message: string; link: string; label: string };
export type Reach = { ok: true; audience: number; recipients: number; in_app: number; emails: number } | { ok: false; message: string };
export type SendResult = { ok: boolean; message: string };
export type Target = { id: string; label: string; count?: number };
export type Targets = { directors: Target[]; films: Target[]; members: Target[] };

export type Campaign = {
  id: string; kind: Kind; subject: string; audience: Audience; audience_label: string | null; channels: Channel[]; created_at: string; sender: string | null;
  in_app: number; in_app_read: number; emails: number; queued: number; sent: number; delivered: number; bounced: number; failed: number; skipped: number;
};
