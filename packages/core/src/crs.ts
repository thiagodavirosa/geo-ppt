import type { Coord } from "./esquema";

export type Conversor = (c: Coord) => Coord;
/** fn: conversor para graus; null: já está em graus; undefined: projeção reconhecida mas não suportada. */
export interface Src { fn: Conversor | null | undefined; rotulo: string }

/** UTM (elipsoide GRS80/SIRGAS 2000; diferença para WGS84 desprezível em mapas de slide) -> lon/lat. */
export function utm(zona: number, sul = true): Conversor {
  const a = 6378137, f = 1 / 298.257222101, k0 = 0.9996, e2 = f * (2 - f), ep2 = e2 / (1 - e2);
  const e1 = (1 - Math.sqrt(1 - e2)) / (1 + Math.sqrt(1 - e2));
  const lon0 = ((zona * 6 - 183) * Math.PI) / 180;
  return ([X, Y]) => {
    const x = X - 500000, y = sul ? Y - 10000000 : Y;
    const mu = y / k0 / (a * (1 - e2 / 4 - (3 * e2 * e2) / 64 - (5 * e2 ** 3) / 256));
    const p1 = mu + ((3 * e1) / 2 - (27 * e1 ** 3) / 32) * Math.sin(2 * mu) + ((21 * e1 * e1) / 16 - (55 * e1 ** 4) / 32) * Math.sin(4 * mu)
      + ((151 * e1 ** 3) / 96) * Math.sin(6 * mu) + ((1097 * e1 ** 4) / 512) * Math.sin(8 * mu);
    const s = Math.sin(p1), c = Math.cos(p1), t = Math.tan(p1);
    const N = a / Math.sqrt(1 - e2 * s * s), T = t * t, C = ep2 * c * c, R = (a * (1 - e2)) / Math.pow(1 - e2 * s * s, 1.5), D = x / (N * k0);
    const lat = p1 - ((N * t) / R) * ((D * D) / 2 - ((5 + 3 * T + 10 * C - 4 * C * C - 9 * ep2) * D ** 4) / 24
      + ((61 + 90 * T + 298 * C + 45 * T * T - 252 * ep2 - 3 * C * C) * D ** 6) / 720);
    const lon = lon0 + (D - ((1 + 2 * T + C) * D ** 3) / 6 + ((5 - 2 * C + 28 * T - 3 * C * C + 8 * ep2 + 24 * T * T) * D ** 5) / 120) / c;
    return [(lon * 180) / Math.PI, (lat * 180) / Math.PI];
  };
}

export const mercator: Conversor = ([x, y]) => [((x / 6378137) * 180) / Math.PI, ((2 * Math.atan(Math.exp(y / 6378137)) - Math.PI / 2) * 180) / Math.PI];

/** Interpreta .prj (WKT), "EPSG:nnnn" ou o crs de um GeoJSON. null = não identificado (presumir graus). */
export function srcDoTexto(t: string | undefined | null): Src | null {
  if (!t) return null;
  let m = /UTM[ _]?zone[ _]?(\d{1,2})\s*([NS])?/i.exec(t);
  if (m) { const sul = (m[2] || "S").toUpperCase() === "S"; return { fn: utm(+m[1], sul), rotulo: `UTM ${m[1]}${sul ? "S" : "N"}` }; }
  if (/Mercator_Auxiliary_Sphere|Pseudo[-_ ]Mercator|Popular Visualisation|3857|900913/i.test(t)) return { fn: mercator, rotulo: "Web Mercator" };
  m = /EPSG[:"]+\s*(\d{4,5})/i.exec(t) || /urn:ogc:def:crs:EPSG::(\d+)/i.exec(t);
  if (m) {
    const c = +m[1];
    if (c >= 31978 && c <= 31985) return { fn: utm(c - 31960), rotulo: `SIRGAS UTM ${c - 31960}S` };
    if (c >= 32718 && c <= 32725) return { fn: utm(c - 32700), rotulo: `WGS84 UTM ${c - 32700}S` };
    if (c >= 32618 && c <= 32625) return { fn: utm(c - 32600, false), rotulo: `WGS84 UTM ${c - 32600}N` };
    if ([4326, 4674, 4618, 4989].includes(c)) return { fn: null, rotulo: "graus" };
  }
  if (/PROJCS|PROJCRS/i.test(t)) return { fn: undefined, rotulo: "projeção não suportada" };
  return null;
}

/** Escolha manual quando o arquivo não informa o SRC: "utm18".."utm25" (sul) ou "merc". */
export function srcManual(v: string): Src | null {
  if (v === "merc") return { fn: mercator, rotulo: "Web Mercator (manual)" };
  const m = /^utm(\d+)$/.exec(v);
  return m ? { fn: utm(+m[1]), rotulo: `UTM ${m[1]}S (manual)` } : null;
}
