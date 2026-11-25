import type { Metadata } from "next";
import { filmMetadata, FilmPageView } from "../../FilmPageView";

export const revalidate = 3600; // admin saves refresh it right away
export const dynamicParams = true;

type Props = { params: Promise<{ slug: string; director: string }> };

// Built the first time someone opens each film, then kept.
export async function generateStaticParams() {
  return [];
}

export const generateMetadata = ({ params }: Props): Promise<Metadata> => filmMetadata({ params });

export default function FilmByDirector({ params }: Props) {
  return FilmPageView({ params });
}
