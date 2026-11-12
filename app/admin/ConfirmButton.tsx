"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

/**
 * A submit button for actions that can't be undone. The first press asks "Delete? Press again",
 * the second submits. No browser dialog, works with the keyboard, and resets after a few seconds.
 */
export default function ConfirmButton({ children, confirm = "Press again to confirm", className = "button ghost small danger-text", name, value }: {
  children: React.ReactNode; confirm?: string; className?: string; name?: string; value?: string;
}) {
  const [armed, setArmed] = useState(false);
  const { pending } = useFormStatus();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  return (
    <button
      type="submit"
      className={className + (armed ? " is-armed" : "")}
      name={name}
      value={value}
      disabled={pending}
      aria-live="polite"
      onClick={(event) => {
        if (armed) return;
        event.preventDefault();
        setArmed(true);
        timer.current = setTimeout(() => setArmed(false), 4000);
      }}
    >
      {pending ? "Working…" : armed ? confirm : children}
    </button>
  );
}
