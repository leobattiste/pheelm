"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import SignInForm, { LINK_ERRORS, safeNext } from "@/components/SignInForm";
import { getBrowserClient } from "@/lib/supabase/client";

/** The sign-in page, for links from emails and pages that need you signed in first. */
export default function LoginPage() {
  const router = useRouter();
  const [next, setNext] = useState("/me");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const destination = safeNext(params.get("next"));
    setNext(destination);
    const authError = params.get("error");
    setError(authError ? LINK_ERRORS[authError] ?? LINK_ERRORS.link : "");
    getBrowserClient()?.auth.getUser().then(({ data }) => {
      if (data.user && !authError) router.replace(destination);
    }).catch(() => {});
  }, [router]);

  return (
    <section className="panel signin-page">
      {error !== null && <SignInForm next={next} initialError={error} />}
    </section>
  );
}
