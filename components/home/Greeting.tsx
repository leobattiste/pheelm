"use client";

import { useEffect, useState } from "react";

/** "Good evening, Leo" in the member's own time of day; "Welcome back" until it knows the hour. */
export default function Greeting({ name }: { name: string | null }) {
  const [hour, setHour] = useState<number | null>(null);
  useEffect(() => setHour(new Date().getHours()), []);
  const part = hour === null ? null : hour < 5 ? "Good evening" : hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const first = name?.split(/\s+/)[0];
  return <h1 className="home-greeting">{part ? (first ? `${part}, ${first}` : part) : first ? `Welcome back, ${first}` : "Welcome back"}</h1>;
}
