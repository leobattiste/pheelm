"use client";

import Link from "next/link";
import { openSignIn } from "./SignInSheet";

/** "Get early access" on the home page: opens the sign-up sheet (or the sign-in page without it). */
export default function EarlyAccessButton() {
  return (
    <Link className="button" href="/login?mode=signup&next=/films" onClick={(e) => { if (openSignIn("signup")) e.preventDefault(); }}>
      Get early access
    </Link>
  );
}
