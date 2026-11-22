export type HomeFeature = {
  id: string; title: string; intro: string; alt: string; shot: string;
  features: { title: string; text: string }[];
};

/**
 * "Inside Pheelm" on the home page: the four parts of Pheelm as a grid of cards. Each card shows a
 * screenshot of the real page (in the visitor's theme), what that part is for, and three things you
 * can do there. Two cards across on wide screens, one on phones. Nothing to click, so it needs no
 * script. Screenshots live in public/home (scripts/capture-home-screenshots.mjs).
 */
export default function FeatureGrid({ features }: { features: HomeFeature[] }) {
  return (
    <section className="hf" aria-labelledby="hf-title">
      <div className="hf-head">
        <h2 id="hf-title">Inside Pheelm</h2>
        <p>Four ways to discover, save and share films by Black directors.</p>
      </div>
      <ul className="hf-grid">
        {features.map((f) => (
          <li key={f.id} className="hf-card">
            <div className="hf-card-head">
              <h3>{f.title}</h3>
              <p className="hf-panel-intro">{f.intro}</p>
            </div>
            <figure className="hf-stage">
              <img className="shot-dark" src={`/home/${f.shot}-dark.webp`} alt={f.alt} width={1600} height={1600} loading="lazy" decoding="async" />
              <img className="shot-light" src={`/home/${f.shot}-light.webp`} alt={f.alt} width={1600} height={1600} loading="lazy" decoding="async" />
            </figure>
            <ul className="hf-list">
              {f.features.map((x) => (
                <li key={x.title} className="hf-item">
                  <h4>{x.title}</h4>
                  <p>{x.text}</p>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </section>
  );
}
