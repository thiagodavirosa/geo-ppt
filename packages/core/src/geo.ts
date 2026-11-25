import type { Coord, Feicao } from "./esquema";
import { clamp } from "./util";

/** Distância aproximada em km entre dois pontos lon/lat (equirretangular local; ok para recorte por km). */
export function segKm(a: Coord, b: Coord): number {
  const ml = (((a[1] + b[1]) / 2) * Math.PI) / 180;
  return Math.hypot((b[0] - a[0]) * Math.cos(ml) * 111.32, (b[1] - a[1]) * 110.57);
}
export const comprimentoLinha = (l: Coord[]) => l.reduce((s, c, i) => (i ? s + segKm(l[i - 1], c) : 0), 0);
export const comprimento = (partes: Coord[][]) => partes.reduce((s, l) => s + comprimentoLinha(l), 0);
export const interpolar = (a: Coord, b: Coord, t: number): Coord => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

/** Recorta uma sequência de partes entre as frações t0..t1 do comprimento total. */
export function recortar(partes: Coord[][], t0: number, t1: number): Coord[][] {
  const total = comprimento(partes);
  if (!total) return [];
  const d0 = clamp(Math.min(t0, t1), 0, 1) * total, d1 = clamp(Math.max(t0, t1), 0, 1) * total;
  const out: Coord[][] = [];
  let acc = 0;
  for (const linha of partes) {
    let cur: Coord[] | null = null;
    for (let i = 1; i < linha.length; i++) {
      const a = linha[i - 1], b = linha[i], L = segKm(a, b), s = acc, e = acc + L;
      acc = e;
      if (e < d0 || s > d1 || L === 0) { if (cur && s > d1) { out.push(cur); cur = null; } continue; }
      const pa = s >= d0 ? a : interpolar(a, b, (d0 - s) / L);
      const pb = e <= d1 ? b : interpolar(a, b, (d1 - s) / L);
      if (!cur) cur = [pa];
      cur.push(pb);
    }
    if (cur && cur.length > 1) out.push(cur);
  }
  return out;
}

/** Ponto a uma fração t do comprimento das partes. */
export function pontoEm(partes: Coord[][], t: number): Coord | null {
  const total = comprimento(partes);
  if (!total) return partes[0]?.[0] ?? null;
  const d = clamp(t, 0, 1) * total;
  let acc = 0;
  for (const l of partes) for (let i = 1; i < l.length; i++) {
    const L = segKm(l[i - 1], l[i]);
    if (acc + L >= d) return interpolar(l[i - 1], l[i], L ? (d - acc) / L : 0);
    acc += L;
  }
  const u = partes[partes.length - 1];
  return u[u.length - 1];
}

export type Caixa4 = [number, number, number, number];
export function envelope(feicoes: Feicao[], bb: Caixa4 = [Infinity, Infinity, -Infinity, -Infinity]): Caixa4 {
  for (const f of feicoes) for (const p of f.geom.partes) for (const c of p) {
    if (c[0] < bb[0]) bb[0] = c[0];
    if (c[1] < bb[1]) bb[1] = c[1];
    if (c[0] > bb[2]) bb[2] = c[0];
    if (c[1] > bb[3]) bb[3] = c[1];
  }
  return bb;
}
export const envelopeValido = (bb: Caixa4) => Number.isFinite(bb[0]);

export function reprojetar(feicoes: Feicao[], fn: (c: Coord) => Coord) {
  for (const f of feicoes) f.geom.partes = f.geom.partes.map((p) => p.map(fn));
}
export function pareceProjetado(feicoes: Feicao[]): boolean {
  const bb = envelope(feicoes.slice(0, 200));
  return Math.abs(bb[0]) > 180 || Math.abs(bb[2]) > 180 || Math.abs(bb[1]) > 90 || Math.abs(bb[3]) > 90;
}

/* ---------- polígonos ---------- */
const area = (r: Coord[]) => { let a = 0; for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += (r[j][0] + r[i][0]) * (r[j][1] - r[i][1]); return a / 2; };

export function dentro(pt: Coord, aneis: Coord[][]): boolean {
  let c = false;
  for (const r of aneis) for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, yi] = r[i], [xj, yj] = r[j];
    if (yi > pt[1] !== yj > pt[1] && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

/** Ponto representativo de um polígono: centroide do maior anel; se cair fora, meio do maior trecho interno na mesma latitude. */
export function pontoInterno(aneis: Coord[][]): Coord | null {
  if (!aneis.length) return null;
  const maior = aneis.reduce((a, b) => (Math.abs(area(b)) > Math.abs(area(a)) ? b : a));
  let A = 0, cx = 0, cy = 0;
  for (let i = 0, j = maior.length - 1; i < maior.length; j = i++) {
    const f = maior[j][0] * maior[i][1] - maior[i][0] * maior[j][1];
    A += f; cx += (maior[j][0] + maior[i][0]) * f; cy += (maior[j][1] + maior[i][1]) * f;
  }
  const c: Coord = A ? [cx / (3 * A), cy / (3 * A)] : maior[0];
  if (dentro(c, aneis)) return c;
  const y = c[1], xs: number[] = [];
  for (const r of aneis) for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, yi] = r[i], [xj, yj] = r[j];
    if (yi > y !== yj > y) xs.push(((xj - xi) * (y - yi)) / (yj - yi) + xi);
  }
  xs.sort((a, b) => a - b);
  let melhor: Coord | null = null, larg = -1;
  for (let i = 0; i + 1 < xs.length; i += 2) if (xs[i + 1] - xs[i] > larg) { larg = xs[i + 1] - xs[i]; melhor = [(xs[i] + xs[i + 1]) / 2, y]; }
  return melhor ?? maior[0];
}
