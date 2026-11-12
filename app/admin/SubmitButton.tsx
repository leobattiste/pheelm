"use client";

import { useFormStatus } from "react-dom";

/** A submit button that shows it's working while its form is being sent. */
export default function SubmitButton({ children, pendingLabel = "Saving…", className = "button small", name, value }: {
  children: React.ReactNode; pendingLabel?: string; className?: string; name?: string; value?: string;
}) {
  const { pending } = useFormStatus();
  return <button type="submit" className={className} name={name} value={value} disabled={pending}>{pending ? pendingLabel : children}</button>;
}
