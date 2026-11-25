import type { Coord, Feicao, Geometria } from "./esquema";
import { lerZip } from "./zip";
import { extensao, nomeBase } from "./util";

/** Resultado da leitura de um arquivo: feições ainda no SRC de origem + texto do SRC (prj/crs). */
export interface Lido { nome: string; feicoes: Feicao[]; srcTexto: string }

/* ---------- GeoJSON ---------- */
type GJ = { type: string; coordinates?: any; geometries?: GJ[] };
export function deGeoJson(g: GJ | null | undefined, out: Geometria[] = []): Geometria[] {
  if (!g) return out;
  const c = g.coordinates;
  const xy = (p: number[]): Coord => [p[0], p[1]];
  switch (g.type) {
    case "Point": out.push({ tipo: "ponto", partes: [[xy(c)]] }); break;
    case "MultiPoint": out.push({ tipo: "ponto", partes: c.map((p: number[]) => [xy(p)]) }); break;
    case "LineString": out.push({ tipo: "linha", partes: [c.map(xy)] }); break;
    case "MultiLineString": out.push({ tipo: "linha", partes: c.map((l: number[][]) => l.map(xy)) }); break;
    case "Polygon": out.push({ tipo: "poligono", partes: c.map((l: number[][]) => l.map(xy)) }); break;
    case "MultiPolygon": out.push({ tipo: "poligono", partes: c.flat(1).map((l: number[][]) => l.map(xy)) }); break;
    case "GeometryCollection": (g.geometries || []).forEach((x) => deGeoJson(x, out)); break;
  }
  return out;
}

export function lerGeoJson(texto: string, nome = "camada.geojson"): Lido {
  const j = JSON.parse(texto);
  const lista = j.type === "FeatureCollection" ? j.features : j.type === "Feature" ? [j] : [{ type: "Feature", properties: {}, geometry: j }];
  const feicoes: Feicao[] = [];
  for (const f of lista) for (const geom of deGeoJson(f.geometry)) feicoes.push({ geom, props: f.properties || {} });
  return { nome, feicoes, srcTexto: j.crs ? JSON.stringify(j.crs) : "" };
}

/* ---------- KML / KMZ ---------- */
/** `DP`: DOMParser (no navegador é o global; nos testes, @xmldom/xmldom). */
export function lerKml(texto: string, nome = "camada.kml", DP: any = (globalThis as any).DOMParser): Lido {
  if (!DP) throw new Error("KML requer DOMParser.");
  const doc = new DP().parseFromString(texto, "text/xml");
  const porTag = (el: any, t: string): any[] => Array.from(el.getElementsByTagNameNS("*", t));
  const filhos = (el: any): any[] => Array.from(el.childNodes || []).filter((n: any) => n.nodeType === 1);
  const coords = (s?: string): Coord[] =>
    (s || "").trim().split(/\s+/).map((x) => x.split(",").map(Number)).filter((c) => c.length >= 2 && Number.isFinite(c[0])).map((c) => [c[0], c[1]] as Coord);
  const feicoes: Feicao[] = [];
  for (const pm of porTag(doc, "Placemark")) {
    const props: Record<string, unknown> = {};
    const nm = filhos(pm).find((c) => c.localName === "name"); if (nm) props.name = nm.textContent.trim();
    const ds = filhos(pm).find((c) => c.localName === "description"); if (ds) props.description = ds.textContent.trim();
    porTag(pm, "Data").forEach((d) => { const v = porTag(d, "value")[0]; props[d.getAttribute("name")] = v ? v.textContent.trim() : ""; });
    porTag(pm, "SimpleData").forEach((d) => { props[d.getAttribute("name")] = d.textContent.trim(); });
    const pts = porTag(pm, "Point").map((p) => coords(porTag(p, "coordinates")[0]?.textContent)).filter((p) => p.length);
    if (pts.length) feicoes.push({ geom: { tipo: "ponto", partes: pts.map((p) => [p[0]]) }, props });
    const linhas = porTag(pm, "LineString").map((l) => coords(porTag(l, "coordinates")[0]?.textContent)).filter((l) => l.length > 1);
    if (linhas.length) feicoes.push({ geom: { tipo: "linha", partes: linhas }, props });
    const aneis = porTag(pm, "LinearRing").map((r) => coords(porTag(r, "coordinates")[0]?.textContent)).filter((r) => r.length > 2);
    if (aneis.length) feicoes.push({ geom: { tipo: "poligono", partes: aneis }, props });
  }
  return { nome, feicoes, srcTexto: "" };
}

export async function lerKmz(buf: ArrayBuffer, nome = "camada.kmz", DP?: any): Promise<Lido> {
  const arqs = await lerZip(buf);
  const kmls = Object.keys(arqs).filter((n) => /\.kml$/i.test(n));
  if (!kmls.length) throw new Error("KMZ sem arquivo KML.");
  const principal = kmls.find((n) => /(^|\/)doc\.kml$/i.test(n)) || kmls[0];
  return { ...lerKml(new TextDecoder().decode(arqs[principal]), nome, DP), nome };
}

/* ---------- Shapefile ---------- */
export function lerShp(buf: ArrayBuffer): (Geometria | null)[] {
  const dv = new DataView(buf), out: (Geometria | null)[] = [];
  const pt = (o: number): Coord => [dv.getFloat64(o, true), dv.getFloat64(o + 8, true)];
  let off = 100;
  while (off + 12 <= buf.byteLength) {
    const len = dv.getInt32(off + 4, false) * 2, s = off + 8, t = dv.getInt32(s, true);
    let g: Geometria | null = null;
    if ([1, 11, 21].includes(t)) g = { tipo: "ponto", partes: [[pt(s + 4)]] };
    else if ([8, 18, 28].includes(t)) { const n = dv.getInt32(s + 36, true); g = { tipo: "ponto", partes: Array.from({ length: n }, (_, i) => [pt(s + 40 + 16 * i)]) }; }
    else if ([3, 13, 23, 5, 15, 25].includes(t)) {
      const np = dv.getInt32(s + 36, true), n = dv.getInt32(s + 40, true), po = s + 44, ps = po + 4 * np, partes: Coord[][] = [];
      for (let i = 0; i < np; i++) {
        const a = dv.getInt32(po + 4 * i, true), b = i + 1 < np ? dv.getInt32(po + 4 * (i + 1), true) : n, l: Coord[] = [];
        for (let j = a; j < b; j++) l.push(pt(ps + 16 * j));
        partes.push(l);
      }
      g = { tipo: [3, 13, 23].includes(t) ? "linha" : "poligono", partes };
    }
    out.push(g);
    off = s + len;
  }
  return out;
}

/** Atributos do .dbf; codificação pelo .cpg ou detectada (UTF-8, senão Windows-1252). */
export function lerDbf(buf: ArrayBuffer, cpg?: string): Record<string, unknown>[] {
  const u8 = new Uint8Array(buf), dv = new DataView(buf);
  const n = dv.getUint32(4, true), hl = dv.getUint16(8, true), rl = dv.getUint16(10, true);
  const campos: { nome: string; tipo: string; tam: number }[] = [];
  for (let o = 32; o < hl - 1 && u8[o] !== 0x0d; o += 32) {
    let nome = "";
    for (let i = 0; i < 11 && u8[o + i]; i++) nome += String.fromCharCode(u8[o + i]);
    campos.push({ nome, tipo: String.fromCharCode(u8[o + 11]), tam: u8[o + 16] });
  }
  let cod = "windows-1252";
  if (cpg) { if (/utf-?8/i.test(cpg)) cod = "utf-8"; else if (/8859-?1|latin/i.test(cpg)) cod = "iso-8859-1"; }
  else { try { new TextDecoder("utf-8", { fatal: true }).decode(u8.subarray(hl, hl + n * rl)); cod = "utf-8"; } catch { cod = "windows-1252"; } }
  const dec = new TextDecoder(cod), linhas: Record<string, unknown>[] = [];
  for (let r = 0; r < n; r++) {
    let p = hl + r * rl + 1;
    const lin: Record<string, unknown> = {};
    for (const c of campos) {
      const bruto = dec.decode(u8.subarray(p, p + c.tam)).trim();
      p += c.tam;
      lin[c.nome] = c.tipo === "N" || c.tipo === "F" ? (bruto === "" ? null : Number(bruto)) : c.tipo === "L" ? /^[YT]/i.test(bruto) : bruto;
    }
    linhas.push(lin);
  }
  return linhas;
}

/** Lê uma seleção de arquivos (GeoJSON, KML, KMZ, SHP+DBF+PRJ+CPG soltos ou em ZIP). */
export async function lerArquivos(lista: { nome: string; buf: ArrayBuffer }[], DP?: any): Promise<Lido[]> {
  const out: Lido[] = [];
  const shp: Record<string, { nome: string; shp?: ArrayBuffer; dbf?: ArrayBuffer; prj?: string; cpg?: string }> = {};
  const txt = (b: ArrayBuffer) => new TextDecoder().decode(b);
  const parteShp = (nome: string, b: ArrayBuffer) => {
    const k = nomeBase(nome).toLowerCase(), e = extensao(nome);
    const s = (shp[k] ||= { nome: nomeBase(nome) });
    if (e === "shp" || e === "dbf") s[e] = b; else if (e === "prj" || e === "cpg") s[e] = txt(b);
  };
  const umArquivo = async (nome: string, b: ArrayBuffer) => {
    const e = extensao(nome);
    if (e === "geojson" || e === "json") out.push(lerGeoJson(txt(b), nome));
    else if (e === "kml") out.push(lerKml(txt(b), nome, DP));
    else if (e === "kmz") out.push(await lerKmz(b, nome, DP));
    else if (["shp", "dbf", "prj", "cpg", "shx"].includes(e)) parteShp(nome, b);
  };
  for (const { nome, buf } of lista) {
    if (extensao(nome) === "zip") { for (const [n, b] of Object.entries(await lerZip(buf))) await umArquivo(n, b); }
    else await umArquivo(nome, buf);
  }
  for (const s of Object.values(shp)) {
    if (!s.shp) continue;
    const geoms = lerShp(s.shp), atrs = s.dbf ? lerDbf(s.dbf, s.cpg) : [];
    const feicoes = geoms.map((g, i) => (g ? { geom: g, props: atrs[i] || {} } : null)).filter((f): f is Feicao => !!f);
    out.push({ nome: s.nome + ".shp", feicoes, srcTexto: s.prj || "" });
  }
  return out;
}
