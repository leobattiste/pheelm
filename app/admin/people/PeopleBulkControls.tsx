"use client";

import DirectorCard from "@/components/DirectorCard";
import { countryName } from "@/lib/format";
import type { DirectorSummary } from "@/lib/types";
import { AdminSelectionBar, useAdminSelection } from "../AdminSelectionBar";

export type AdminPersonRow = {
  id: string; slug: string; name: string; country: string | null; bio: string | null;
  photo_url: string | null; in_directory: boolean;
  credits: { role: string }[];
  previews: DirectorSummary["previews"];
};

export default function PeopleBulkControls({ people, canDelete }: { people: AdminPersonRow[]; canDelete: boolean }) {
  const { selected, toggle, togglePage, clear } = useAdminSelection("people");
  const ids = people.map((person) => person.id);
  const allSelected = ids.length > 0 && ids.every((id) => selected.includes(id));
  const someSelected = ids.some((id) => selected.includes(id));

  return (
    <div className="admin-managed-list">
      <div className="admin-select-line">
        <label className="check">
          <input type="checkbox" checked={allSelected} ref={(node) => { if (node) node.indeterminate = someSelected && !allSelected; }} onChange={(event) => togglePage(ids, event.target.checked)} />
          Select displayed
        </label>
        <span className="muted">Choose people to manage</span>
      </div>
      <AdminSelectionBar selected={selected} onClear={clear} entity="people" canDelete={canDelete} />
      <ul className="director-grid admin-director-grid">
        {people.map((person) => {
          const directed = person.credits.filter((credit) => credit.role === "director").length;
          return (
            <DirectorCard key={person.id} href={`/admin/people/${person.id}`} director={{
              id: person.id, slug: person.slug, name: person.name, country: person.country,
              photo_url: person.photo_url, films: directed, first: 0, last: 0, previews: person.previews,
            }} meta={`${person.country ? countryName(person.country) + " • " : ""}${directed} ${directed === 1 ? "film" : "films"} directed`} footer={
              <div className="admin-card-controls admin-card-selection">
                <label className="check">
                  <input type="checkbox" checked={selected.includes(person.id)} onChange={(event) => toggle(person.id, event.target.checked)} aria-label={`Select ${person.name}`} />
                  Select
                </label>
                <span className={`status-pill ${person.in_directory ? "published" : "draft"}`}>{person.in_directory ? "Shown" : "Hidden"}</span>
                {!person.bio && <span className="status-pill">Missing bio</span>}
                {!person.photo_url && <span className="status-pill">Missing photo</span>}
              </div>
            } />
          );
        })}
      </ul>
    </div>
  );
}
