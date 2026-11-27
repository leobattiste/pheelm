"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { startJob, stopJob } from "./actions";

/** Start, or Stop while it runs. */
export function JobButton({ kind, jobId, disabled }: { kind: string; jobId: string | null; disabled?: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const run = () => start(async () => {
    setError("");
    const r = jobId ? await stopJob(jobId) : await startJob(kind);
    if (!r.ok) setError(r.message);
    router.refresh();
  });
  return (
    <span className="admin-job-action">
      <button type="button" className={jobId ? "button ghost small" : "button small"} onClick={run} disabled={disabled || pending}>
        {pending ? (jobId ? "Stopping…" : "Starting…") : jobId ? "Stop" : "Start"}
      </button>
      {error && <span className="admin-job-error" role="alert">{error}</span>}
    </span>
  );
}

/** While a job runs, refreshes the page every few seconds so progress moves. */
export function JobsRefresher() {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => { if (document.visibilityState === "visible") router.refresh(); }, 5000);
    return () => clearInterval(id);
  }, [router]);
  return <p className="visually-hidden" role="status">Jobs are running. This page updates by itself.</p>;
}
