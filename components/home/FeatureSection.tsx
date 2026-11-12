export type Feature = { title: string; text: string };

/**
 * One part of Pheelm on the home page: a heading, a square screenshot of the real page
 * (desktop, in the visitor's theme), and three things you can do. Screenshots live in public/home and are
 * captured from the live site by scripts/capture-home-screenshots.mjs.
 */
export default function FeatureSection({ id, title, intro, features, shot, alt }: {
  id: string; title: string; intro: string; features: Feature[]; shot: string; alt: string;
}) {
  return (
    <section className="home-feature" aria-labelledby={`${id}-title`}>
      <div className="statement-body home-feature-head">
        <h2 id={`${id}-title`}>{title}</h2>
        <p>{intro}</p>
      </div>
      <div className="home-feature-body">
      <figure className="home-feature-shot">
        <img className="shot-dark" src={`/home/${shot}-dark.webp`} alt={alt} width={1600} height={1600} loading="lazy" decoding="async" />
        <img className="shot-light" src={`/home/${shot}-light.webp`} alt={alt} width={1600} height={1600} loading="lazy" decoding="async" />
      </figure>
      <ul className="home-feature-list">
        {features.map((f) => (
          <li key={f.title} className="home-feature-item">
            <h3>{f.title}</h3>
            <p>{f.text}</p>
          </li>
        ))}
      </ul>
      </div>
    </section>
  );
}
