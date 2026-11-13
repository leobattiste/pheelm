import { requireAdmin } from "@/lib/admin";
import ConfirmButton from "../../ConfirmButton";
import SubmitButton from "../../SubmitButton";
import { Empty, PageHeader, Panel, plural } from "../../ui";
import { addBannedWord, removeBannedWord } from "../actions";

type Word = { word: string; kind: string; instead: string | null; added_at: string };
const KINDS: [string, string][] = [
  ["swearing", "Swearing"], ["racist", "Racial slurs"], ["antisemitic", "Antisemitic slurs"], ["sexist", "Sexist slurs"],
  ["homophobic", "Homophobic slurs"], ["transphobic", "Transphobic slurs"], ["ableist", "Ableist slurs"],
];

/**
 * The words members can't use in comments, bios and watchlist descriptions (see
 * supabase/banned-words.sql). Members are told the kind of word and the suggested alternative,
 * never the word. Matching already catches look-alike characters, punctuation between letters,
 * stretched letters, endings (s, ed, ing…) and whole words only, so one entry covers the variants.
 */
export default async function BannedWords({ searchParams }: { searchParams: Promise<{ error?: string; saved?: string; removed?: string }> }) {
  const { db } = await requireAdmin("/admin/community/banned-words");
  const q = await searchParams;
  const { data, error } = await db.rpc("admin_banned_words");
  const words = (data ?? []) as Word[];

  return (
    <>
      <PageHeader title="Banned words" description="Words members can't use in comments, bios and watchlist descriptions. They're told what kind of word it is and what to write instead, never the word itself." />
      {q.error && <p className="notice error" role="alert">{q.error}</p>}
      {q.saved && <p className="notice ok" role="status">Saved. It applies right away.</p>}
      {q.removed && <p className="notice ok" role="status">Removed. Members can use it again.</p>}
      {error ? <p className="notice error">The list couldn&apos;t load. If this keeps happening, run <code>supabase/banned-words.sql</code> in Supabase.</p> : (
        <>
          <Panel title="Add a word">
            <form action={addBannedWord} className="form admin-word-form">
              <label className="field">Word or phrase<input name="word" required minLength={3} maxLength={40} pattern="[A-Za-z]+( [A-Za-z]+)*" autoComplete="off" spellCheck={false} placeholder="Letters only" /></label>
              <label className="field">Kind
                <select name="kind" defaultValue="swearing">{KINDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
              </label>
              <label className="field">Suggest instead (optional)<input name="instead" maxLength={24} autoComplete="off" placeholder="b-word" /></label>
              <SubmitButton>Add word</SubmitButton>
            </form>
            <p className="muted">One entry also covers 0/1/3/4/5/@/$ look-alikes, dots or dashes between letters, stretched letters and endings like s, ed, er and ing. Whole words only, so &ldquo;Scunthorpe&rdquo; and &ldquo;Niger&rdquo; stay fine. Adding a word that&apos;s already there changes its kind and suggestion.</p>
          </Panel>
          {words.length ? KINDS.map(([kind, label]) => {
            const inKind = words.filter((w) => w.kind === kind);
            if (!inKind.length) return null;
            return (
              <Panel key={kind} title={`${label} (${plural(inKind.length, "word")})`}>
                <ul className="admin-word-list">
                  {inKind.map((w) => (
                    <li key={w.word}>
                      <span><strong>{w.word}</strong>{w.instead ? <span className="muted"> · suggests “{w.instead}”</span> : <span className="muted"> · no suggestion</span>}</span>
                      <form action={removeBannedWord}><input type="hidden" name="word" value={w.word} /><ConfirmButton confirm="Allow it?">Remove</ConfirmButton></form>
                    </li>
                  ))}
                </ul>
              </Panel>
            );
          }) : <Empty title="No banned words">Add the first one above.</Empty>}
        </>
      )}
    </>
  );
}
