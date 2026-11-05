import "server-only";
import { geoEqualEarth, geoPath } from "d3-geo";
import countries from "i18n-iso-countries";
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import world from "world-atlas/countries-110m.json";

export type MapCountry = { code: string | null; name: string; d: string };

export const MAP_WIDTH = 960;
export const MAP_HEIGHT = 470;

let cache: MapCountry[] | null = null;

/**
 * Country outlines as SVG paths, drawn once on the server (Natural Earth 1:110m via world-atlas).
 * Codes are two-letter ISO codes, the same ones the directory uses.
 */
export function worldMap(): MapCountry[] {
  if (cache) return cache;
  const topo = world as unknown as Topology<{ countries: GeometryCollection<{ name: string }> }>;
  const geo = feature(topo, topo.objects.countries);
  // Antarctica takes space and has no filmmakers in the directory.
  const shapes = geo.features.filter((f) => f.id !== "010");
  const projection = geoEqualEarth().fitSize([MAP_WIDTH, MAP_HEIGHT], { type: "FeatureCollection", features: shapes });
  const path = geoPath(projection).digits(1);
  cache = shapes.map((f) => ({
    code: f.id ? countries.numericToAlpha2(String(f.id)) ?? null : null,
    name: f.properties?.name ?? "",
    d: path(f) ?? "",
  }));
  return cache;
}
