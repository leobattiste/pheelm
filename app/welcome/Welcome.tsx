"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { updatePublicName, type NameState } from "@/app/me/actions";
import ProfileLinksFields from "@/components/ProfileLinksFields";
import type { ProfileLinks } from "@/lib/profile-links";
import ProfilePhotoField from "@/components/ProfilePhotoField";
import ProfileBioField from "@/components/ProfileBioField";
import Icon from "@/components/Icon";
import Poster from "@/components/Poster";
import { initials } from "@/lib/format";
import { getBrowserClient } from "@/lib/supabase/client";
import { useBannedWordToast } from "@/components/Toast";
import { isBannedWordMessage } from "@/lib/banned-words";

type Person = { id: string; name: string; place: string | null; photo: string | null };
type Pick = { id: string; title: string; year: number; poster: string | null; directors: string[] };
type Props = { next: string; userId: string; handle: string | null; name: string | null; people: Person[]; films: Pick[]; avatarUrl?: string | null; bio?: string | null; links?: ProfileLinks };

const WELCOMED = "pheelm:welcomed";

/** Three short steps for a new member. Follows and saves happen as they're tapped. */
export default function Welcome({ next, userId, handle, name, people, films, avatarUrl, bio, links }: Props) {
  const router = useRouter();
  const [step, setStep] = useState(handle ? 1 : 0);
  const [state, action, pending] = useActionState<NameState, FormData>(updatePublicName, null);
  useBannedWordToast(state);
  const [followed, setFollowed] = useState<Set<string>>(new Set());
  const [saved, setSaved] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!state?.ok) return;
    window.dispatchEvent(new Event("profilechange"));
    setStep(1);
  }, [state]);

  const finish = () => {
    try { localStorage.setItem(WELCOMED, "1"); } catch {}
    router.replace(next);
    router.refresh();
  };

  const toggle = async (table: "follows" | "watchlist", id: string, on: boolean) => {
    const db = getBrowserClient();
    if (!db) return;
    const set = table === "follows" ? setFollowed : setSaved;
    set((s) => { const n = new Set(s); if (on) n.add(id); else n.delete(id); return n; });
    const key = table === "follows" ? "person_id" : "film_id";
    const { error } = on
      ? await db.from(table).insert({ user_id: userId, [key]: id })
      : await db.from(table).delete().eq("user_id", userId).eq(key, id);
    if (error && !/duplicate/i.test(error.message)) set((s) => { const n = new Set(s); if (on) n.delete(id); else n.add(id); return n; });
  };

  return (
    <section className="page welcome">
      <ol className="welcome-steps" aria-label="Steps">
        {["Your profile", "Directors", "Films"].map((label, i) => (
          <li key={label} aria-current={i === step ? "step" : undefined} className={i < step ? "is-done" : undefined}>{label}</li>
        ))}
      </ol>

      {step === 0 && (
        <div className="welcome-step">
          <header className="page-head">
            <h1>Welcome to Pheelm.</h1>
            <p className="lead">Choose a name and a handle. They&rsquo;re shown on your profile, your watchlists and your comments.</p>
          </header>
          <form action={action} className="form welcome-form">
            <ProfilePhotoField photo={avatarUrl ?? null} name={name || handle || "You"} disabled={pending} />
            <label className="field">
              Name
              <input name="display_name" defaultValue={name ?? ""} maxLength={60} placeholder="Your name" autoComplete="name" />
            </label>
            <label className="field">
              Handle
              <input name="handle" required maxLength={24} pattern="[A-Za-z0-9_]{3,24}" autoCapitalize="none" spellCheck={false} placeholder="yourname" aria-describedby="welcome-handle-hint" />
              <span className="hint" id="welcome-handle-hint">Your page will be pheelm.com/@handle. 3 to 24 letters, numbers or _</span>
            </label>
            <ProfileBioField bio={bio} disabled={pending} />
            <ProfileLinksFields links={links} disabled={pending} />
            {state && !state.ok && !isBannedWordMessage(state.message) && <p className="notice error" role="alert">{state.message}</p>}
            <div className="actions">
              <button className="button" type="submit" disabled={pending}>{pending ? "Saving…" : "Continue"}</button>
              <button className="button ghost" type="button" onClick={() => setStep(1)}>Skip for now</button>
            </div>
          </form>
        </div>
      )}

      {step === 1 && (
        <div className="welcome-step">
          <header className="page-head">
            <h1>Follow a few directors.</h1>
            <p className="lead">You&rsquo;ll hear when a director you follow has a new film on Pheelm.</p>
          </header>
          <ul className="welcome-people">
            {people.map((p) => {
              const on = followed.has(p.id);
              return (
                <li key={p.id}>
                  <button type="button" className="welcome-person" aria-pressed={on} onClick={() => toggle("follows", p.id, !on)}>
                    {p.photo
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img className="welcome-face" src={p.photo} alt="" width={56} height={56} loading="lazy" />
                      : <span className="welcome-face" aria-hidden="true">{initials(p.name)}</span>}
                    <span className="welcome-who"><strong>{p.name}</strong>{p.place && <span>{p.place}</span>}</span>
                    <span className="welcome-check" aria-hidden="true"><Icon name={on ? "check" : "plus"} /></span>
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="actions welcome-foot">
            <button className="button" type="button" onClick={() => setStep(2)}>{followed.size ? `Continue` : "Skip"}</button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="welcome-step">
          <header className="page-head">
            <h1>Start your Watchlist.</h1>
            <p className="lead">Tap the films you want to see. You can sort them into watchlists later.</p>
          </header>
          <ul className="welcome-films">
            {films.map((f) => {
              const on = saved.has(f.id);
              return (
                <li key={f.id}>
                  <button type="button" className="welcome-film" aria-pressed={on} aria-label={`${on ? "Remove" : "Save"} ${f.title}`} onClick={() => toggle("watchlist", f.id, !on)}>
                    <Poster title={f.title} year={f.year} directors={f.directors} src={f.poster} sizes="(min-width: 900px) 180px, 30vw" />
                    <span className="welcome-check" aria-hidden="true"><Icon name={on ? "check" : "plus"} /></span>
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="actions welcome-foot">
            <button className="button" type="button" onClick={finish}>Start exploring</button>
          </div>
        </div>
      )}
    </section>
  );
}
