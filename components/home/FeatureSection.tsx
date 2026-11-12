import Icon, { type IconName } from "@/components/Icon";

export type Feature = { title: string; text: string; icon: IconName };

/**
 * One part of Pheelm on the home page: a heading, a screenshot of the real page (desktop,
 * signed in, in the visitor's theme), then three things you can do. Screenshots live in public/home and are
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
      <figure className="home-feature-shot">
        <img className="shot-dark" src={`/home/${shot}-dark.webp`} alt={alt} width={2400} height={1500} loading="lazy" decoding="async" />
        <img className="shot-light" src={`/home/${shot}-light.webp`} alt={alt} width={2400} height={1500} loading="lazy" decoding="async" />
      </figure>
      <ul className="home-feature-list">
        {features.map((f) => (
          <li key={f.title} className="home-feature-item">
            <Icon name={f.icon} />
            <h3>{f.title}</h3>
            <p>{f.text}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
