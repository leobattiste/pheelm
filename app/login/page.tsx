"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import SignInForm, { LINK_ERRORS, safeNext, type SignInStep } from "@/components/SignInForm";
import { getBrowserClient } from "@/lib/supabase/client";

/** The sign-in page, for links from emails and pages that need you signed in first. */
export default function LoginPage() {
  const router = useRouter();
  const [next, setNext] = useState("/me");
  const [error, setError] = useState<string | null>(null);
  const [signup, setSignup] = useState(false);
  const [step, setStep] = useState<SignInStep>("start");
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const destination = safeNext(params.get("next"));
    setNext(destination);
    setSignup(params.get("mode") === "signup");
    const authError = params.get("error");
    setError(authError ? LINK_ERRORS[authError] ?? LINK_ERRORS.link : "");
    const choosing = params.get("step") === "new-password";
    setResetting(params.get("reason") === "reset");
    getBrowserClient()?.auth.getUser().then(({ data }) => {
      // Signed in from an emailed link but still needs a password: stay and choose one.
      if (data.user && choosing) return setStep("new-password");
      if (data.user && !authError) router.replace(destination);
    }).catch(() => {});
  }, [router]);

  return (
    <section className="panel signin-page">
      {error !== null && <SignInForm key={step} next={next} initialError={error} mode={signup ? "signup" : "signin"} initialStep={step} resetting={resetting} />}
    </section>
  );
}
