'use client';
export default function ProfileError({reset}:{reset:()=>void}) {
 return <section className="page"><h1>Profile couldn’t load</h1><p>Please try again in a moment.</p><button type="button" className="button" onClick={reset}>Try again</button></section>;
}
