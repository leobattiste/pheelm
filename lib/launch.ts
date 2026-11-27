/**
 * Early access switch. While it's on, signed-out visitors see only the pages proxy.ts lists as
 * open (the home page, the catalog and the pages about Pheelm), and the sign-up wording says
 * "early access".
 *
 * To launch: set NEXT_PUBLIC_EARLY_ACCESS=off in Vercel (Production) and redeploy.
 * Anything else, or nothing, keeps early access on.
 */
export const EARLY_ACCESS = process.env.NEXT_PUBLIC_EARLY_ACCESS?.trim().toLowerCase() !== "off";
