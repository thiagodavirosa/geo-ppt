import type { Caixa, Coord, Dados, Feicao, Mapa, Ponto, Trecho } from "./esquema";
import { camada, ehPrincipal, estiloAtivo, feicoesDe, feicoesVisiveis, geometriaTrecho, type GeometriaTrecho } from "./mapa";
import { ENVELOPE_UF } from "./catalogo";
import { envelope, envelopeValido } from "./geo";
import { clamp, escXml as E, fmt, nomeBr } from "./util";

/** Fonte usada no SVG e na medição (Arial tem métrica previsível em qualquer máquina). */
export const FONTE = "Arial, Helvetica, sans-serif";

/* ---------- medição de texto (métrica Helvetica/Arial, 1/1000 em) ---------- */
const LARG: Record<string, number> = {};
" !\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~".split("").forEach((ch, i) => {
  LARG[ch] = [278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556,
    1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556, 333,
    556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584][i];
});
Object.assign(LARG, { "–": 556, "—": 1000, "“": 333, "”": 333, "‘": 222, "’": 222, "·": 278, "×": 584, "°": 400, "º": 365, "ª": 370, "…": 1000 });

/** Largura aproximada (px) de um texto em Arial. */
export function medirTexto(t: string, tamanho: number, negrito = false): number {
  let s = 0;
  for (const ch of t.normalize("NFD").replace(/[\u0300-\u036f]/g, "")) s += LARG[ch] ?? 556;
  return (s / 1000) * tamanho * (negrito ? 1.07 : 1);
}

/** Quebra em linhas que cabem em `max` px (max 0 = sem quebra); respeita \n. */
export function quebrarTexto(t: string, tamanho: number, max: number, negrito = false): string[] {
  const out: string[] = [];
  for (const par of String(t ?? "").split("\n")) {
    if (!max) { out.push(par); continue; }
    let cur = "";
    for (const w of par.split(/\s+/).filter(Boolean)) {
      const prova = cur ? `${cur} ${w}` : w;
      if (cur && medirTexto(prova, tamanho, negrito) > max) { out.push(cur); cur = w; } else cur = prova;
    }
    out.push(cur);
  }
  return out;
}

/* ---------- projeção ---------- */
export interface Projecao { k: number; cx: number; cy: number; cosl: number; ox: number; oy: number; fwd(lon: number, lat: number): Coord; inv(x: number, y: number): Coord }

/** Feições do quadro (UF escolhida) — definem o enquadramento e o recorte. */
export function feicoesDoQuadro(m: Mapa, dados: Dados): Feicao[] {
  const e = m.enquadramento, c = camada(m, e.camadaId);
  return feicoesDe(c, dados).filter((f) => f.geom.tipo === "poligono" && String(f.props[e.campo] ?? "").trim() === e.valor);
}

/** Equirretangular ajustada ao elemento. No ajuste "fixo", a escala/posição gravada prevalece (e é criada na 1ª vez). */
export function projecao(m: Mapa, dados: Dados): Projecao {
  const e = m.enquadramento, W = m.tela.largura, H = m.tela.altura;
  let fs = feicoesDoQuadro(m, dados);
  if (!fs.length) fs = m.camadas.filter((c) => c.visivel).flatMap((c) => feicoesDe(c, dados));
  let bb = envelope(fs);
  if (!envelopeValido(bb)) bb = ENVELOPE_UF[e.valor] ? [...ENVELOPE_UF[e.valor]] : [-74, -34, -34, 6];
  const mg = clamp(e.margem, 0, 30) / 100, z = clamp(e.zoom, 10, 1000) / 100;
  let cx = (bb[0] + bb[2]) / 2, cy = (bb[1] + bb[3]) / 2, cosl = Math.cos((cy * Math.PI) / 180);
  const bw = Math.max((bb[2] - bb[0]) * cosl, 1e-6), bh = Math.max(bb[3] - bb[1], 1e-6);
  let k = Math.min((W * (1 - 2 * mg)) / bw, (H * (1 - 2 * mg)) / bh) * z;
  let ox = W / 2 + e.deslocX, oy = H / 2 + e.deslocY;
  if (e.ajuste === "fixo") {
    if (!e.fixo) e.fixo = { cx, cy, cosl, kBase: k / z, ax: ox, ay: oy };
    ({ cx, cy, cosl } = e.fixo); k = e.fixo.kBase * z; ox = e.fixo.ax; oy = e.fixo.ay;
  }
  return { k, cx, cy, cosl, ox, oy,
    fwd: (lon, lat) => [ox + (lon - cx) * cosl * k, oy - (lat - cy) * k],
    inv: (x, y) => [cx + (x - ox) / (cosl * k), cy - (y - oy) / k] };
}

/** Troca de ajuste sem salto visual. */
export function definirAjuste(m: Mapa, dados: Dados, modo: "auto" | "fixo") {
  const e = m.enquadramento, P = projecao(m, dados);
  if (modo === "fixo") e.fixo = { cx: P.cx, cy: P.cy, cosl: P.cosl, kBase: P.k / (clamp(e.zoom, 10, 1000) / 100), ax: P.ox, ay: P.oy };
  if (modo === "auto" && e.ajuste === "fixo") { e.deslocX = P.ox - m.tela.largura / 2; e.deslocY = P.oy - m.tela.altura / 2; }
  e.ajuste = modo;
}
export function recentralizar(m: Mapa) { const e = m.enquadramento; e.deslocX = e.deslocY = 0; e.zoom = 100; e.fixo = null; }
export function deslocar(m: Mapa, dx: number, dy: number) {
  const e = m.enquadramento;
  if (e.ajuste === "fixo" && e.fixo) { e.fixo.ax += dx; e.fixo.ay += dy; } else { e.deslocX += dx; e.deslocY += dy; }
}

/* ---------- layout das caixas e da tabela ---------- */
export interface LinhaCaixa { t: string; principal: boolean }
export interface CaixaLayout {
  id: string; caixa: Caixa; ancora: Coord; trecho: boolean;
  linhas: LinhaCaixa[]; w: number; h: number; x: number; y: number; de: Coord; para: Coord; linhaVisivel: boolean;
}
export interface TabelaLayout { x: number; y: number; w: number; h: number; larguras: number[]; hCab: number; hLinhas: number[]; cab: string[][]; corpo: string[][][] }
export interface Layout { P: Projecao; geoTrechos: Map<string, GeometriaTrecho>; caixas: CaixaLayout[]; tabela: TabelaLayout | null }

export function linhasDaCaixa(it: Trecho | Ponto, g?: GeometriaTrecho): LinhaCaixa[] {
  const c = it.caixa, s = c.mostrar, trecho = "br" in it, out: LinhaCaixa[] = [];
  const cab: string[] = [];
  if (s.nome) cab.push(trecho ? nomeBr((it as Trecho).br) : (it as Ponto).nome);
  if (trecho && s.uf && (it as Trecho).uf) cab.push((it as Trecho).uf);
  const princ = `${c.prefixo ? c.prefixo + " " : ""}${cab.join("/")}`.trim();
  if (princ) out.push({ t: princ, principal: true });
  if (trecho) {
    const t = it as Trecho;
    if (s.km) out.push({ t: `km ${fmt(Math.min(t.kmIni, t.kmFim))} – ${fmt(Math.max(t.kmIni, t.kmFim))}`, principal: false });
    if (s.extensao && g) out.push({ t: `Extensão: ${fmt(g.extensao)} km`, principal: false });
  } else if (s.coordenadas) out.push({ t: `${(it as Ponto).lat.toFixed(5)}, ${(it as Ponto).lon.toFixed(5)}`, principal: false });
  c.extra.split("\n").map((x) => x.trim()).filter(Boolean).forEach((t) => out.push({ t, principal: false }));
  if (!out.length) out.push({ t: trecho ? nomeBr((it as Trecho).br) : (it as Ponto).nome, principal: true });
  return out;
}

const pad = (fs: number) => Math.round(fs * 0.6);
function medidasCaixa(c: Caixa, linhas: LinhaCaixa[]) {
  const fs = c.tamanhoFonte, p = pad(fs);
  const w = Math.ceil(Math.max(...linhas.map((l) => medirTexto(l.t, l.principal ? fs : Math.round(fs * 0.85), l.principal && c.negrito))) + 2 * p);
  const h = Math.ceil(linhas.reduce((s, l, i) => s + (i === 0 ? fs * 1.15 : l.principal ? fs * 1.25 : fs * 1.15), 0) + 1.6 * p);
  return { w, h };
}

/** Posiciona caixa e indicativo a partir de dx/dy (rápido: usado durante o arraste). */
export function posicionarCaixa(m: Mapa, c: CaixaLayout) {
  const W = m.tela.largura, H = m.tela.altura, { dx, dy } = c.caixa;
  c.x = clamp(c.ancora[0] + (dx ?? 0), -c.w * 0.5, W - c.w * 0.5);
  c.y = clamp(c.ancora[1] + (dy ?? 0), -c.h * 0.5, H - c.h * 0.5);
  const px = clamp(c.ancora[0], c.x, c.x + c.w), py = clamp(c.ancora[1], c.y, c.y + c.h);
  const dist = Math.hypot(c.ancora[0] - px, c.ancora[1] - py);
  const ux = (c.ancora[0] - px) / (dist || 1), uy = (c.ancora[1] - py) / (dist || 1), recuo = Math.min(5, dist);
  c.de = [px, py]; c.para = [c.ancora[0] - ux * recuo, c.ancora[1] - uy * recuo]; c.linhaVisivel = dist >= 10;
}

const sobrepoe = (a: number[], b: number[]) => a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];
/** Posição automática: tenta seis lugares ao redor da âncora, evitando bordas, tabela e outras caixas. */
function posicaoAutomatica(m: Mapa, c: CaixaLayout, outras: CaixaLayout[], tab: TabelaLayout | null) {
  const W = m.tela.largura, H = m.tela.altura;
  const tb = tab ? [tab.x, tab.y, tab.x + tab.w, tab.y + tab.h] : null;
  const ocupadas = outras.map((o) => [o.x, o.y, o.x + o.w, o.y + o.h]);
  const cands: Coord[] = [[55, -95 - c.h / 2], [-55 - c.w, -95 - c.h / 2], [55, 70], [-55 - c.w, 70], [90, -c.h / 2], [-90 - c.w, -c.h / 2]];
  let melhor = cands[0], nota = Infinity;
  for (const [dx, dy] of cands) {
    const r = [c.ancora[0] + dx, c.ancora[1] + dy, c.ancora[0] + dx + c.w, c.ancora[1] + dy + c.h];
    let n = 0;
    if (r[0] < 0 || r[1] < 0 || r[2] > W || r[3] > H) n += 10;
    if (tb && sobrepoe(r, tb)) n += 5;
    ocupadas.forEach((o) => { if (sobrepoe(r, o)) n += 3; });
    if (n < nota) { nota = n; melhor = [dx, dy]; }
    if (n === 0) break;
  }
  c.caixa.dx = melhor[0]; c.caixa.dy = melhor[1];
}

export function layoutTabela(m: Mapa): TabelaLayout | null {
  const T = m.tabela;
  if (!T.visivel || !T.colunas.length) return null;
  const s = T.estilo, fs = s.tamanhoFonte, p = s.espacamento, lh = Math.round(fs * 1.25);
  const interna = T.colunas.map((c) => (c.largura > 0 ? Math.max(10, c.largura - 2 * p) : 0));
  const cab = T.colunas.map((c, i) => quebrarTexto(c.nome, fs, interna[i], s.cabecalhoNegrito));
  const corpo = T.linhas.map((l) => T.colunas.map((_, i) => quebrarTexto(l[i] ?? "", fs, interna[i])));
  const larguras = T.colunas.map((_, i) => {
    if (interna[i]) return interna[i] + 2 * p;
    let mx = 0;
    cab[i].forEach((t) => (mx = Math.max(mx, medirTexto(t, fs, s.cabecalhoNegrito))));
    corpo.forEach((r) => r[i].forEach((t) => (mx = Math.max(mx, medirTexto(t, fs)))));
    return Math.ceil(mx + 2 * p) || 30;
  });
  const alt = (cel: string[][]) => Math.max(...cel.map((c) => c.length), 1) * lh + 2 * p;
  const hCab = alt(cab), hLinhas = corpo.map(alt);
  const w = larguras.reduce((a, b) => a + b, 0), h = hCab + hLinhas.reduce((a, b) => a + b, 0);
  if (T.x === null || T.y === null) { T.x = Math.max(0, m.tela.largura - w - 24); T.y = 24; }
  T.x = clamp(T.x, -w * 0.8, m.tela.largura - w * 0.2);
  T.y = clamp(T.y, -h * 0.8, m.tela.altura - h * 0.2);
  return { x: T.x, y: T.y, w, h, larguras, hCab, hLinhas, cab, corpo };
}

/** Calcula projeção, recortes dos trechos, caixas e tabela. Preenche posições automáticas (dx/dy e x/y nulos). */
export function calcularLayout(m: Mapa, dados: Dados): Layout {
  const P = projecao(m, dados), W = m.tela.largura, H = m.tela.altura;
  const geoTrechos = new Map<string, GeometriaTrecho>();
  m.trechos.forEach((t) => geoTrechos.set(t.id, geometriaTrecho(m, dados, t)));
  const tabela = layoutTabela(m);
  const caixas: CaixaLayout[] = [];
  for (const it of [...m.trechos, ...m.pontos]) {
    const trecho = "br" in it, g = trecho ? geoTrechos.get(it.id) : undefined;
    const geo = trecho ? g?.ancora : ([(it as Ponto).lon, (it as Ponto).lat] as Coord);
    if (!geo) continue;
    const a = P.fwd(geo[0], geo[1]);
    if (a[0] < 0 || a[1] < 0 || a[0] > W || a[1] > H) continue;   /* âncora fora do elemento: sem caixa */
    const linhas = linhasDaCaixa(it, g), { w, h } = medidasCaixa(it.caixa, linhas);
    const c: CaixaLayout = { id: it.id, caixa: it.caixa, ancora: a, trecho, linhas, w, h, x: 0, y: 0, de: a, para: a, linhaVisivel: false };
    if (it.caixa.dx === null || it.caixa.dy === null) posicaoAutomatica(m, c, caixas, tabela);
    posicionarCaixa(m, c);
    caixas.push(c);
  }
  return { P, geoTrechos, caixas, tabela };
}

/* ---------- SVG ---------- */
function caminho(P: Projecao, partes: Coord[][], fechar: boolean): string {
  let s = "";
  for (const p of partes) {
    let lx: number | null = null, ly = 0, n = 0;
    for (let i = 0; i < p.length; i++) {
      const [x, y] = P.fwd(p[i][0], p[i][1]);
      if (lx !== null && i < p.length - 1 && Math.abs(x - lx) < 0.6 && Math.abs(y - ly) < 0.6) continue;
      s += (n ? "L" : "M") + x.toFixed(1) + " " + y.toFixed(1);
      lx = x; ly = y; n++;
    }
    if (fechar && n) s += "Z";
  }
  return s;
}
function simbolo(forma: Ponto["simbolo"], x: number, y: number, r: number): string {
  const f = (v: number) => v.toFixed(1);
  switch (forma) {
    case "losango": return `<path d="M${f(x)} ${f(y - r * 1.25)}L${f(x + r)} ${f(y)}L${f(x)} ${f(y + r * 1.25)}L${f(x - r)} ${f(y)}Z"/>`;
    case "quadrado": return `<rect x="${f(x - r)}" y="${f(y - r)}" width="${f(2 * r)}" height="${f(2 * r)}"/>`;
    case "triangulo": return `<path d="M${f(x)} ${f(y - r * 1.2)}L${f(x + r * 1.1)} ${f(y + r * 0.8)}L${f(x - r * 1.1)} ${f(y + r * 0.8)}Z"/>`;
    default: return `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}"/>`;
  }
}

/** Base do mapa: fundo, vizinhas, sombra, camadas, trechos e símbolos dos pontos (sem caixas e tabela). */
export function svgBase(m: Mapa, dados: Dados, L: Layout, idp = "g"): string {
  const e = m.enquadramento, P = L.P, FL = camada(m, e.camadaId);
  const quadro = feicoesDoQuadro(m, dados), dQuadro = quadro.map((f) => caminho(P, f.geom.partes, true)).join("");
  const recorte = e.recortar && quadro.length > 0, sd = e.sombra.distancia;
  let h = `<defs>`;
  if (recorte) h += `<clipPath id="${idp}-recorte"><path d="${dQuadro}" clip-rule="evenodd"/></clipPath>`;
  h += `<filter id="${idp}-sombra" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="${(sd * 0.8).toFixed(1)}" dy="${sd}" stdDeviation="${e.sombra.desfoque}" flood-color="#000" flood-opacity="${e.sombra.opacidade}"/></filter></defs>`;
  if (!m.tela.transparente) h += `<rect width="${m.tela.largura}" height="${m.tela.altura}" fill="${E(m.tela.fundo)}"/>`;
  if (FL && e.vizinhas) {
    const outras = feicoesDe(FL, dados).filter((f) => f.geom.tipo === "poligono" && !quadro.includes(f));
    h += `<path d="${outras.map((f) => caminho(P, f.geom.partes, true)).join("")}" fill="${E(e.corVizinhas)}" fill-rule="evenodd" stroke="${E(FL.estilo.contorno)}" stroke-width="1"/>`;
  }
  if (FL && FL.visivel && e.sombra.ativa && quadro.length)
    h += `<path d="${dQuadro}" fill="${E(FL.estilo.preenchimento)}" fill-rule="evenodd" filter="url(#${idp}-sombra)"/>`;
  for (const c of m.camadas) {
    if (!c.visivel) continue;
    const s = estiloAtivo(c), fs = feicoesVisiveis(c, dados);
    const polis = fs.filter((f) => f.geom.tipo === "poligono"), linhas = fs.filter((f) => f.geom.tipo === "linha"), pts = fs.filter((f) => f.geom.tipo === "ponto");
    h += `<g data-camada="${E(c.id)}"${recorte ? ` clip-path="url(#${idp}-recorte)"` : ""}>`;
    if (polis.length) h += `<path d="${polis.map((f) => caminho(P, f.geom.partes, true)).join("")}" fill="${E(s.preenchimento)}" fill-opacity="${s.opacidade}" fill-rule="evenodd" stroke="${E(s.contorno)}" stroke-width="${s.espessura}" stroke-linejoin="round"/>`;
    if (linhas.length) h += `<path d="${linhas.map((f) => caminho(P, f.geom.partes, false)).join("")}" fill="none" stroke="${E(s.contorno)}" stroke-width="${s.espessura}" stroke-linejoin="round" stroke-linecap="round"/>`;
    if (pts.length) {
      h += `<g fill="${E(s.preenchimento)}" stroke="${E(s.contorno)}" stroke-width="2">`;
      for (const f of pts) for (const p of f.geom.partes) {
        const [x, y] = P.fwd(p[0][0], p[0][1]), r = f.props.capital === "sim" ? s.tamanho * 1.35 : s.tamanho;
        h += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}"/>`;
      }
      h += `</g>`;
    }
    if (s.rotuloCampo) {
      const rot = [...pts, ...polis].filter((f) => !(c.municipios?.rotularSoPrincipais && !ehPrincipal(c, f)));
      h += `<g font-family="${FONTE}" font-size="${s.rotuloTamanho}" font-weight="700" fill="${E(s.rotuloCor)}" stroke="#ffffff" stroke-width="3" paint-order="stroke" stroke-linejoin="round">`;
      for (const f of rot) {
        const ehPt = f.geom.tipo === "ponto", p = ehPt ? f.geom.partes[0][0] : f.pt?.partes[0][0];
        if (!p) continue;
        const [x, y] = P.fwd(p[0], p[1]);
        h += ehPt ? `<text x="${(x + s.tamanho + 4).toFixed(1)}" y="${(y + 4).toFixed(1)}">${E(f.props[s.rotuloCampo])}</text>`
          : `<text x="${x.toFixed(1)}" y="${(y + 4).toFixed(1)}" text-anchor="middle">${E(f.props[s.rotuloCampo])}</text>`;
      }
      h += `</g>`;
    }
    h += `</g>`;
  }
  for (const t of m.trechos) {
    const g = L.geoTrechos.get(t.id);
    if (g?.pedacos.length) h += `<path data-trecho="${E(t.id)}" d="${caminho(P, g.pedacos, false)}" fill="none" stroke="${E(t.cor)}" stroke-width="${t.espessura}" stroke-linecap="round" stroke-linejoin="round"/>`;
  }
  for (const p of m.pontos) {
    const [x, y] = P.fwd(p.lon, p.lat);
    h += `<g data-ponto="${E(p.id)}" fill="${E(p.cor)}" stroke="${E(p.contorno)}" stroke-width="2">${simbolo(p.simbolo, x, y, p.tamanho)}</g>`;
  }
  return h;
}

export interface OpcoesSobreposicao { selecionado?: string | null; idp?: string }
export const ID_TABELA = "TABELA";

/** Caixas ancoradas e tabela (redesenhadas sozinhas durante o arraste). */
export function svgSobreposicao(m: Mapa, L: Layout, o: OpcoesSobreposicao = {}): string {
  const idp = o.idp ?? "g";
  let h = `<defs><filter id="${idp}-scx" x="-15%" y="-25%" width="140%" height="170%"><feDropShadow dx="2" dy="3" stdDeviation="2" flood-color="#000" flood-opacity=".35"/></filter>`
    + `<filter id="${idp}-stb" x="-5%" y="-5%" width="115%" height="120%"><feDropShadow dx="4" dy="5" stdDeviation="4" flood-color="#000" flood-opacity=".35"/></filter>`;
  for (const c of L.caixas) h += `<marker id="${idp}-s-${E(c.id)}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0L10 5L0 10Z" fill="${E(c.caixa.linha)}"/></marker>`;
  h += `</defs>`;
  const T = L.tabela;
  if (T) h += svgTabela(m, T, idp, o.selecionado === ID_TABELA);
  for (const c of L.caixas) {
    const k = c.caixa, fs = k.tamanhoFonte, p = pad(fs), f = (v: number) => v.toFixed(1);
    h += `<g data-item="${E(c.id)}">`;
    if (c.linhaVisivel) h += `<line x1="${f(c.de[0])}" y1="${f(c.de[1])}" x2="${f(c.para[0])}" y2="${f(c.para[1])}" stroke="${E(k.linha)}" stroke-width="2" marker-end="url(#${idp}-s-${E(c.id)})"/>`;
    if (c.trecho) h += `<circle cx="${f(c.ancora[0])}" cy="${f(c.ancora[1])}" r="4.5" fill="${E(k.linha)}" stroke="#ffffff" stroke-width="1.5"/>`;
    const sel = o.selecionado === c.id;
    h += `<g data-caixa="${E(c.id)}" transform="translate(${f(c.x)} ${f(c.y)})"><rect width="${c.w}" height="${c.h}" rx="3" fill="${E(k.fundo)}"${k.sombra ? ` filter="url(#${idp}-scx)"` : ""}${sel ? ` stroke="#f35919" stroke-width="2" stroke-dasharray="5 3"` : ""}/>`;
    let y = 0.8 * p;
    c.linhas.forEach((l, i) => {
      const tam = l.principal ? fs : Math.round(fs * 0.85);
      y += i === 0 ? fs * 1.15 : l.principal ? fs * 1.25 : fs * 1.15;
      h += `<text x="${p}" y="${f(y - fs * 0.25)}" font-family="${FONTE}" font-size="${tam}" fill="${E(k.texto)}"${l.principal && k.negrito ? ' font-weight="700"' : ""}>${E(l.t)}</text>`;
    });
    h += `</g></g>`;
  }
  return h;
}

function svgTabela(m: Mapa, T: TabelaLayout, idp: string, sel: boolean): string {
  const s = m.tabela.estilo, cols = m.tabela.colunas, fs = s.tamanhoFonte, lh = Math.round(fs * 1.25), f = (v: number) => v.toFixed(1);
  const xs: number[] = []; T.larguras.reduce((acc, w) => (xs.push(acc), acc + w), 0);
  let h = `<g data-tabela="1" transform="translate(${f(T.x)} ${f(T.y)})"><g${s.sombra ? ` filter="url(#${idp}-stb)"` : ""}>`;
  h += `<rect width="${T.w}" height="${T.h}" fill="${E(s.fundo)}"/>`;
  const linha = (cel: string[][], y: number, alt: number, fundo: string | null, cor: string, negrito: boolean) => {
    if (fundo) h += `<rect y="${f(y)}" width="${T.w}" height="${alt}" fill="${E(fundo)}"/>`;
    cel.forEach((ls, i) => {
      const al = cols[i]?.alinhamento ?? "centro";
      const tx = al === "esquerda" ? xs[i] + s.espacamento : al === "direita" ? xs[i] + T.larguras[i] - s.espacamento : xs[i] + T.larguras[i] / 2;
      const anc = al === "esquerda" ? "start" : al === "direita" ? "end" : "middle";
      const y0 = y + (alt - ls.length * lh) / 2 + lh * 0.78;
      ls.forEach((t, k) => { h += `<text x="${f(tx)}" y="${f(y0 + k * lh)}" text-anchor="${anc}" font-family="${FONTE}" font-size="${fs}" fill="${E(cor)}"${negrito ? ' font-weight="700"' : ""}>${E(t)}</text>`; });
    });
  };
  linha(T.cab, 0, T.hCab, s.cabecalhoFundo, s.cabecalhoTexto, s.cabecalhoNegrito);
  let y = T.hCab;
  T.corpo.forEach((cel, r) => {
    if (r > 0) h += `<line x1="0" x2="${T.w}" y1="${f(y)}" y2="${f(y)}" stroke="${E(s.divisoria)}" stroke-width="1"/>`;
    linha(cel, y, T.hLinhas[r], r % 2 ? s.zebra : null, s.texto, false);
    y += T.hLinhas[r];
  });
  if (s.espessuraBorda > 0) h += `<rect width="${T.w}" height="${T.h}" fill="none" stroke="${E(s.borda)}" stroke-width="${s.espessuraBorda}"/>`;
  h += `</g>`;
  if (sel) h += `<rect x="-4" y="-4" width="${T.w + 8}" height="${T.h + 8}" fill="none" stroke="#f35919" stroke-width="2" stroke-dasharray="5 3"/>`;
  return h + `</g>`;
}

/** SVG completo do elemento (o que vai para o slide). */
export function renderSvg(m: Mapa, dados: Dados, o: OpcoesSobreposicao = {}): string {
  const L = calcularLayout(m, dados), W = m.tela.largura, H = m.tela.altura;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${svgBase(m, dados, L, o.idp)}${svgSobreposicao(m, L, o)}</svg>`;
}

